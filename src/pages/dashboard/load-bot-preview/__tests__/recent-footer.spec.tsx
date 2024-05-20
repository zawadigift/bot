import React from 'react';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import { mock_ws } from '@/utils/mock';
import RootStore from 'Stores/root-store';
import { DBotStoreProvider, mockDBotStore } from '@/stores/__useDBotStore';
import RecentFooter from '../recent-footer';

jest.mock('@/external/bot-skeleton/scratch/blockly', () => jest.fn());
jest.mock('@/external/bot-skeleton/scratch/dbot', () => ({
    saveRecentWorkspace: jest.fn(),
    unHighlightAllBlocks: jest.fn(),
}));
jest.mock('@/external/bot-skeleton/scratch/hooks/block_svg', () => jest.fn());

describe('RecentFooter', () => {
    let wrapper: ({ children }: { children: JSX.Element }) => JSX.Element, mock_DBot_store: RootStore | undefined;

    beforeAll(() => {
        const mock_store = mockStore({});
        mock_DBot_store = mockDBotStore(mock_store, mock_ws);

        wrapper = ({ children }: { children: JSX.Element }) => (
            <StoreProvider store={mock_store}>
                <DBotStoreProvider ws={mock_ws} mock={mock_DBot_store}>
                    {children}
                </DBotStoreProvider>
            </StoreProvider>
        );
    });

    it('should render RecentFooter', () => {
        const { container } = render(<RecentFooter />, { wrapper });
        expect(container).toBeInTheDocument();
    });

    it('should render open button', async () => {
        render(<RecentFooter />, { wrapper });
        const open_button = screen.getByText('Open');
        expect(open_button).toBeInTheDocument();
    });
});
