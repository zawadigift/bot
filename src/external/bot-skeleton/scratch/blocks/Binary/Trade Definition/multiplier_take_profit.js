import { getCurrencyDisplayCode } from '@/utils/tmp/currency-helper';
import { localize } from '@/utils/tmp/dummy';

import { config } from '../../../../constants/config';

window.Blockly.Blocks.multiplier_take_profit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Take Profit: {{ currency }} {{ take_profit }}', {
                currency: '%1',
                take_profit: '%2',
            }),
            args0: [
                {
                    type: 'field_label',
                    name: 'CURRENCY_LIST',
                    text: getCurrencyDisplayCode(config.lists.CURRENCY[0]),
                },
                {
                    type: 'input_value',
                    name: 'AMOUNT',
                    check: 'Number',
                },
            ],
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            previousStatement: null,
            nextStatement: null,
            tooltip: localize(
                'Your contract is closed automatically when your profit is more than or equals to this amount. This block can only be used with the multipliers trade type.'
            ),
            category: window.Blockly.Categories.Trade_Definition,
        };
    },
    meta() {
        return {
            display_name: localize('Take Profit'),
            description: localize(
                'Your contract is closed automatically when your profit is more than or equals to this amount. This block can only be used with the multipliers trade type.'
            ),
        };
    },
    onchange(event) {
        if (!this.workspace || this.isInFlyout || this.workspace.isDragging()) {
            return;
        }
        if (
            (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) ||
            event.type === window.Blockly.Events.END_DRAG
        ) {
            this.setCurrency();
        }
    },
    restricted_parents: ['trade_definition_multiplier'],
    setCurrency: window.Blockly.Blocks.trade_definition_tradeoptions.setCurrency,
    getRequiredValueInputs() {
        const field_input = this.getInput('AMOUNT');
        if (field_input.connection.targetBlock()) {
            return {
                AMOUNT: input => {
                    const input_number = Number(input);
                    this.error_message = localize('Take profit must be a positive number.');
                    return !isNaN(input_number) && input_number <= 0;
                },
            };
        }
        return {};
    },
};

window.Blockly.JavaScript.multiplier_take_profit = () => {};
