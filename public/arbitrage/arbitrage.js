let derivWs;
let isConnected = false;
let tradingToken = localStorage.getItem('authToken');
let activeLoginId = localStorage.getItem('active_loginid');
let tickHistory = [];
let currentSymbol = "R_100";
let decimalPlaces = 2;
let stakeAmount = 0;
let activeContracts = new Map(); // Track active contracts
let activeProposals = new Map(); // Track active proposals

let initSurvicateCalled = false;
let tradeResults = [];
let totalWins = 0;
let totalLosses = 0;

// Add new variables at top
let pendingProposals = {
    DIGITOVER: null,
    DIGITUNDER: null
};

// Add Survicate initialization
function setSurvicateUserAttributes(residence, account_type, created_at) {
    if (window.Survicate && window.Survicate.setCustomAttributes) {
        window.Survicate.setCustomAttributes({
            residence,
            account_type,
            created_at,
        });
    }
}

function initSurvicate() {
    if (initSurvicateCalled) return;
    initSurvicateCalled = true;

    const client_accounts = JSON.parse(localStorage.getItem('accountsList')) || undefined;

    if (activeLoginId && client_accounts) {
        const { residence, account_type, created_at } = client_accounts[activeLoginId] || {};
        setSurvicateUserAttributes(residence, account_type, created_at);
    }
}

// Add this new function for trade notifications
function showNotification(message, type = 'info') {
    const container = document.createElement('div');
    container.className = `notification ${type}`;
    container.textContent = message;
    document.body.appendChild(container);

    // Remove notification after 5 seconds
    setTimeout(() => {
        container.remove();
    }, 5000);
}

// Add token validation function
function validateToken() {
    if (!tradingToken) {
        showNotification('No trading token found. Please log in.', 'error');
        return false;
    }
    if (!activeLoginId) {
        showNotification('No active account found. Please log in.', 'error');
        return false;
    }
    return true;
}

// Replace initTradeWebSocket and use single WebSocket initialization
function startWebSocket() {
    if (derivWs?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }

    if (derivWs) {
        derivWs.close();
        tickHistory = [];
    }

    derivWs = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=68848');
    
    derivWs.onopen = function() {
        console.log('WebSocket connected');
        isConnected = true;
        // Authorize first
        if (tradingToken) {
            const authData = { authorize: tradingToken };
            derivWs.send(JSON.stringify(authData));
        }
        requestTickHistory();
    };

    // Add connection lost handling
    derivWs.onclose = function() {
        console.log('WebSocket disconnected');
        isConnected = false;
        // Try to reconnect after 1 second
        setTimeout(startWebSocket, 1000);
    };
    
    derivWs.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.error) {
            showNotification(data.error.message, 'error');
            return;
        }

        // Handle authorization response
        if (data.authorize) {
            requestTradeHistory();
            return;
        }

        // Handle profit table response
        if (data.profit_table) {
            handleProfitTableResponse(data.profit_table);
            return;
        }

        // Handle buy response
        if (data.buy) {
            handleBuyResponse(data.buy);
            return;
        }

        // Handle contract updates
        if (data.proposal_open_contract) {
            handleContractUpdate(data.proposal_open_contract);
            return;
        }

        // Handle proposal response
        if (data.proposal) {
            handleProposalResponse(data.proposal);
            return;
        }

        // Handle tick data
        if (data.history || data.tick) {
            handleTickData(data);
        }
    };

    derivWs.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

// Helper functions to handle different message types
function handleProfitTableResponse(profit_table) {
    if (!profit_table?.transactions || !Array.isArray(profit_table.transactions)) {
        console.error('Invalid profit table response:', profit_table);
        return;
    }

    const trades = profit_table.transactions;
    tradeResults = trades.map(trade => {
        // Add null checks for each property
        if (!trade) return null;

        const profit = typeof trade.profit === 'number' ? trade.profit : 0;
        
        return {
            time: trade.purchase_time ? new Date(trade.purchase_time * 1000).toLocaleTimeString() : 'Unknown',
            digit: trade.entry_tick_display_value ? trade.entry_tick_display_value.slice(-1) : '?',
            isWin: profit >= 0,
            type: trade.shortcode ? (trade.shortcode.includes('DIGIT OVER') ? 'OVER_5' : 'UNDER_4') : 'Unknown',
            profit: profit,
            contractId: trade.contract_id || 'Unknown'
        };
    }).filter(Boolean); // Remove any null entries
    
    totalWins = tradeResults.filter(t => t.isWin).length;
    totalLosses = tradeResults.filter(t => !t.isWin).length;
    
    updateResultsDisplay();
}

function handleBuyResponse(buy) {
    if (!buy?.contract_id) {
        console.error('Invalid buy response:', buy);
        return;
    }

    const contractId = buy.contract_id;
    const contractType = buy.contract_type || 'Unknown';
    activeContracts.set(contractId, {
        type: contractType,
        openTime: new Date(),
        stake: buy.buy_price || 0
    });
    
    subscribeToContract(contractId);
    showNotification(`${contractType} contract opened: ${contractId}`, 'success');
}

function handleContractUpdate(contract) {
    if (!contract?.contract_id) {
        console.error('Invalid contract update:', contract);
        return;
    }

    if (contract.is_sold) {
        const profit = contract.profit || 0;
        const contractId = contract.contract_id;
        const contractData = activeContracts.get(contractId);
        
        if (contractData) {
            const exitDigit = contract.exit_tick_display_value ? 
                contract.exit_tick_display_value.slice(-1) : '?';

            updateTradeResults(exitDigit, profit >= 0, {
                contractId,
                profit,
                type: contractData.type,
                duration: (new Date() - contractData.openTime) / 1000
            });
            activeContracts.delete(contractId);
        }
    }
}

function handleTickData(data) {
    if (data.history && Array.isArray(data.history.prices)) {
        tickHistory = data.history.prices.map((price, index) => ({
            time: data.history.times?.[index] || Date.now(),
            quote: parseFloat(price) || 0
        }));
        detectDecimalPlaces();
    } else if (data.tick?.quote) {
        let tickQuote = parseFloat(data.tick.quote) || 0;
        tickHistory.push({ 
            time: data.tick.epoch || Date.now(), 
            quote: tickQuote 
        });
        if (tickHistory.length > 100) tickHistory.shift();
    }
    updateUI();
}

// Add after WebSocket initialization
function requestTradeHistory() {
    if (!derivWs || derivWs.readyState !== WebSocket.OPEN) {
        return;
    }

    const request = {
        "profit_table": 1,
        "description": 1,
        "sort": "DESC",
        "limit": 10
    };

    derivWs.send(JSON.stringify(request));
}

// Add new function to request trade proposal
function requestProposal(contractType, symbol, stake) {
    const request = {
        proposal: 1,
        subscribe: 1,
        amount: stake,
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        symbol: symbol,
        barrier: contractType === "DIGITOVER" ? "5" : "4"
    };
    
    derivWs.send(JSON.stringify(request));
}

// Modify the placeTrades function
function placeTrades(stake, symbol) {
    if (!derivWs || derivWs.readyState !== WebSocket.OPEN) {
        showNotification('WebSocket not connected', 'error');
        return;
    }

    // Request proposals for both trade types
    requestProposal("DIGITOVER", symbol, stake);
    requestProposal("DIGITUNDER", symbol, stake);
}

// Modify handleProposalResponse function
function handleProposalResponse(proposal) {
    if (!proposal?.id || !proposal?.ask_price) return;

    // Store in active proposals
    activeProposals.set(proposal.id, proposal);

    // Store in pending proposals
    if (proposal.contract_type === "DIGITOVER") {
        pendingProposals.DIGITOVER = proposal;
    } else if (proposal.contract_type === "DIGITUNDER") {
        pendingProposals.DIGITUNDER = proposal;
    }

    // Check if we have both proposals
    if (pendingProposals.DIGITOVER && pendingProposals.DIGITUNDER) {
        // Place both trades
        const overRequest = {
            buy: pendingProposals.DIGITOVER.id,
            price: pendingProposals.DIGITOVER.ask_price
        };
        const underRequest = {
            buy: pendingProposals.DIGITUNDER.id, 
            price: pendingProposals.DIGITUNDER.ask_price
        };

        // Send both trades
        derivWs.send(JSON.stringify(overRequest));
        derivWs.send(JSON.stringify(underRequest));

        // Reset pending proposals
        pendingProposals = {
            DIGITOVER: null,
            DIGITUNDER: null
        };
    }
}

// Add cleanup for pending proposals 
function cleanupTrades() {
    // Reset pending proposals
    pendingProposals = {
        DIGITOVER: null,
        DIGITUNDER: null
    };

    // Forget all proposals
    activeProposals.forEach((proposal, id) => {
        const request = {
            forget: id
        };
        derivWs.send(JSON.stringify(request));
    });
    activeProposals.clear();

    // Close all active contract subscriptions
    activeContracts.forEach((_, contractId) => {
        const request = {
            forget_all: ["proposal_open_contract"],
            contract_id: contractId
        };
        derivWs.send(JSON.stringify(request));
    });
    activeContracts.clear();
}

// Modify beforeunload handler
window.addEventListener('beforeunload', cleanupTrades);

// Add contract subscription function
function subscribeToContract(contractId) {
    const request = {
        proposal_open_contract: 1,
        subscribe: 1,
        contract_id: contractId
    };
    derivWs.send(JSON.stringify(request));
}

// Initialize WebSocket connection
function requestTickHistory() {
    if (derivWs && derivWs.readyState === WebSocket.OPEN) {
        const request = {
            ticks_history: currentSymbol,
            count: 100,
            end: "latest",
            style: "ticks",
            subscribe: 1
        };
        derivWs.send(JSON.stringify(request));
    }
}

// Helper functions for tick analysis
function detectDecimalPlaces() {
    if (tickHistory.length === 0) return;
    let decimalCounts = tickHistory.map(tick => {
        let decimalPart = tick.quote.toString().split(".")[1] || "";
        return decimalPart.length;
    });
    decimalPlaces = Math.max(...decimalCounts, 2);
}

function getLastDigit(price) {
    let priceStr = price.toString();
    let priceParts = priceStr.split(".");
    let decimals = priceParts[1] || "";
    while (decimals.length < decimalPlaces) decimals += "0";
    return Number(decimals.slice(-1));
}

function updateUI() {
    const currentPrice = tickHistory[tickHistory.length - 1]?.quote.toFixed(decimalPlaces);
    document.getElementById("current-price").textContent = currentPrice || "N/A";
    updateDigitDisplay();
}

function updateDigitDisplay() {
    const digitCounts = new Array(10).fill(0);
    tickHistory.forEach(tick => {
        const lastDigit = getLastDigit(tick.quote);
        digitCounts[lastDigit]++;
    });

    const digitPercentages = digitCounts.map(count => (count / tickHistory.length) * 100);
    const maxPercentage = Math.max(...digitPercentages);
    const minPercentage = Math.min(...digitPercentages);
    const currentDigit = getLastDigit(tickHistory[tickHistory.length - 1]?.quote);

    const container = document.getElementById("digit-display-container");
    container.innerHTML = "";

    digitPercentages.forEach((percentage, digit) => {
        const digitContainer = document.createElement("div");
        digitContainer.classList.add("digit-container");

        if (digit === currentDigit) {
            digitContainer.classList.add("current");
            const arrow = document.createElement("div");
            arrow.classList.add("arrow");
            digitContainer.appendChild(arrow);
        }

        const digitBox = document.createElement("div");
        digitBox.classList.add("digit-box");
        if (percentage === maxPercentage) digitBox.classList.add("highest");
        if (percentage === minPercentage) digitBox.classList.add("lowest");
        digitBox.textContent = digit;

        const percentageText = document.createElement("div");
        percentageText.classList.add("digit-percentage");
        percentageText.textContent = `${percentage.toFixed(2)}%`;

        digitContainer.appendChild(digitBox);
        digitContainer.appendChild(percentageText);
        container.appendChild(digitContainer);
    });
}

// Add this function to update trade results
function updateTradeResults(digit, isWin, contractDetails) {
    const result = {
        time: new Date().toLocaleTimeString(),
        digit: digit,
        isWin: isWin,
        type: contractDetails.type,
        contractId: contractDetails.contractId,
        profit: contractDetails.profit,
        duration: contractDetails.duration
    };
    
    tradeResults.unshift(result);
    if (tradeResults.length > 10) tradeResults.pop();
    
    if (isWin) totalWins++;
    else totalLosses++;
    
    updateResultsDisplay();
}

// Modify updateResultsDisplay to show more contract details
function updateResultsDisplay() {
    const resultsContainer = document.getElementById('trade-results');
    const statsContainer = document.getElementById('trade-stats');
    
    // Update stats with safe number handling
    const totalTrades = totalWins + totalLosses;
    const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(2) : '0.00';
    const totalProfit = tradeResults.reduce((sum, trade) => {
        const profit = typeof trade?.profit === 'number' ? trade.profit : 0;
        return sum + profit;
    }, 0).toFixed(2);
    
    statsContainer.innerHTML = `
        <div>Total Trades: ${totalTrades}</div>
        <div>Wins: ${totalWins}</div>
        <div>Losses: ${totalLosses}</div>
        <div>Win Rate: ${winRate}%</div>
        <div>Total Profit: $${totalProfit}</div>
    `;
    
    // Update results list with safer property access
    resultsContainer.innerHTML = tradeResults.map(result => {
        const profit = typeof result?.profit === 'number' ? result.profit.toFixed(2) : '0.00';
        const duration = typeof result?.duration === 'number' ? result.duration.toFixed(1) : '0.0';
        
        return `
            <div class="trade-result ${result.isWin ? 'win' : 'loss'}">
                <span>${result.time || 'Unknown'}</span>
                <span>ID: ${result.contractId || 'Unknown'}</span>
                <span>Digit: ${result.digit || '?'}</span>
                <span>${result.type || 'Unknown'}</span>
                <span>${result.isWin ? 'WIN' : 'LOSS'}</span>
                <span>$${profit}</span>
                <span>${duration}s</span>
            </div>
        `;
    }).join('');
}

// Add clear history functionality
function clearTradingHistory() {
    tradeResults = [];
    totalWins = 0;
    totalLosses = 0;
    updateResultsDisplay();
    showNotification('Trading history cleared', 'info');
}

// Symbol change handler
document.getElementById('symbol').addEventListener('change', function(e) {
    const newSymbol = e.target.value;
    if (newSymbol) {
        currentSymbol = newSymbol;
        tickHistory = [];
        startWebSocket();
    }
});

// Modify the form submission handler
document.getElementById('tradingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!validateToken()) {
        return;
    }

    if (!isConnected) {
        showNotification('Waiting for connection...', 'warning');
        startWebSocket();
        return;
    }

    const stake = parseFloat(document.getElementById('stake').value);
    const symbol = document.getElementById('symbol').value;
    
    if (stake && symbol) {
        // Cleanup any existing trades first
        cleanupTrades();
        
        stakeAmount = stake;
        currentSymbol = symbol;
        
        // Request new trades
        placeTrades(stake, symbol);
        
        // Disable submit button temporarily
        const submitButton = document.querySelector('#tradingForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            setTimeout(() => {
                submitButton.disabled = false;
            }, 2000);
        }
    }
});

// Add token refresh handling
window.addEventListener('storage', (e) => {
    if (e.key === 'authToken') {
        tradingToken = e.newValue;
        if (!tradingToken) {
            showNotification('Trading stopped - token expired', 'error');
        }
    }
    if (e.key === 'active_loginid') {
        activeLoginId = e.newValue;
    }
});

// Add fullscreen functionality
function toggleFullscreen() {
    if (!document.fullscreenElement &&
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    startWebSocket();
    
    // Add fullscreen button event listener
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);

    // Add clear history button to stats container
    const statsContainer = document.getElementById('trade-stats');
    const clearButton = document.createElement('button');
    clearButton.innerHTML = '🗑️ Clear History';
    clearButton.className = 'clear-history-btn';
    clearButton.onclick = clearTradingHistory;
    statsContainer.appendChild(clearButton);
});

// Add this CSS to your existing styles
document.head.insertAdjacentHTML('beforeend', `
    <style>
    .clear-history-btn {
        margin-top: 10px;
        padding: 5px 10px;
        background-color: #ff4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    .clear-history-btn:hover {
        background-color: #cc0000;
    }
    </style>
`);
