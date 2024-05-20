import React from 'react';
import { isDesktop } from '@deriv-com/utils';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import { mock_ws } from '@/utils/mock';
import { DBotStoreProvider, mockDBotStore } from '@/stores/__useDBotStore';
import ToolbarWidgets from '../toolbar-widgets';

jest.mock('@deriv-com/utils', () => ({
    ...jest.requireActual('@deriv-com/utils'),
    isDesktop: jest.fn(),
}));

jest.mock('@/external/bot-skeleton/scratch/blockly', () => jest.fn());
jest.mock('@/external/bot-skeleton/scratch/dbot', () => ({
    saveRecentWorkspace: jest.fn(),
    unHighlightAllBlocks: jest.fn(),
}));
jest.mock('@/external/bot-skeleton/scratch/hooks/block_svg', () => jest.fn());

// // Mocking the imports from @deriv/deriv-charts
jest.mock('@deriv/deriv-charts', () => ({
    ...jest.requireActual('@deriv/deriv-charts'),
    __esModule: true,
    ChartMode: jest.fn(() => <div>Mocked ChartMode</div>),
    DrawTools: jest.fn(() => <div>Mocked DrawTools</div>),
    Share: jest.fn(() => <div>Mocked Share</div>),
    StudyLegend: jest.fn(() => <div>Mocked StudyLegend</div>),
    ToolbarWidget: jest.fn(({ children }) => <div>{children}</div>),
    Views: jest.fn(() => <div>Mocked Views</div>),
}));

describe('ToolbarWidgets', () => {
    let wrapper: ({ children }: { children: JSX.Element }) => JSX.Element;
    const mock_store = mockStore({});
    const mockUpdateChartType = jest.fn();
    const mockUpdateGranularity = jest.fn();

    beforeAll(() => {
        const mock_DBot_store = mockDBotStore(mock_store, mock_ws);

        wrapper = ({ children }: { children: JSX.Element }) => (
            <StoreProvider store={mock_store}>
                <DBotStoreProvider ws={mock_ws} mock={mock_DBot_store}>
                    {children}
                </DBotStoreProvider>
            </StoreProvider>
        );
    });

    it('should render ToolbarWidgets in desktop', async () => {
        (isDesktop as jest.Mock).mockReturnValueOnce(true);
        render(
            <React.Suspense fallback={<div />}>
                <ToolbarWidgets updateChartType={mockUpdateChartType} updateGranularity={mockUpdateGranularity} />
            </React.Suspense>,
            {
                wrapper,
            }
        );
        expect(await screen.findByText('Mocked StudyLegend')).toBeInTheDocument();
    });

    it('should render ToolbarWidgets in mobile', async () => {
        (isDesktop as jest.Mock).mockReturnValueOnce(false);
        render(
            <React.Suspense fallback={<div />}>
                <ToolbarWidgets
                    updateChartType={mockUpdateChartType}
                    updateGranularity={mockUpdateGranularity}
                    position='bottom'
                />
            </React.Suspense>,
            {
                wrapper,
            }
        );
        expect(await screen.findByText('Mocked ChartMode')).toBeInTheDocument();
    });
});
