import { create } from 'zustand';
import { api } from '../services/api';

interface Position {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entry_price: number;
    mark_price: number;
    liquidation_price: number | null;
    margin: number;
    leverage: number;
    take_profit?: number;
    stop_loss?: number;
}

interface Order {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    price: number;
    amount: number;
    filled_quantity: number;
    status: string;
    created_at: string;
}

interface Portfolio {
    balance: number;
    positions: Position[];
    orders: Order[];
    history: any[];
}

interface TradingState {
    symbol: string;
    timeframe: string;
    currentAnalysis: string | null;
    portfolio: Portfolio | null;

    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;
    setCurrentAnalysis: (analysis: string | null) => void;

    fetchPortfolio: () => Promise<void>;
    placeOrder: (symbol: string, side: 'buy' | 'sell', amount: number, leverage: number, type?: 'MARKET' | 'LIMIT', price?: number, stopLoss?: number, takeProfit?: number) => Promise<void>;
    resetAccount: () => Promise<void>;
}

export const useTradingStore = create<TradingState>((set, get) => ({
    symbol: 'BTC/USDT',
    timeframe: '1h',
    currentAnalysis: null,
    portfolio: null,

    setSymbol: (symbol) => set({ symbol }),
    setTimeframe: (timeframe) => set({ timeframe }),
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),

    fetchPortfolio: async () => {
        try {
            const data = await api.get('/paper/dashboard');
            set({ portfolio: data });
        } catch (error) {
            console.error('Failed to fetch portfolio:', error);
            set({ portfolio: null });
        }
    },

    placeOrder: async (symbol, side, amount, leverage, type = 'MARKET', price, stopLoss, takeProfit) => {
        try {
            await api.post('/paper/order', {
                symbol,
                side: side.toUpperCase(),
                amount,
                leverage,
                type,
                price,
                stop_loss: stopLoss,
                take_profit: takeProfit
            });
            await get().fetchPortfolio(); // Refresh after order
        } catch (error) {
            console.error('Failed to place order:', error);
            throw error;
        }
    },

    resetAccount: async () => {
        try {
            await api.post('/paper/reset', { confirm: true });
            await get().fetchPortfolio();
        } catch (error) {
            console.error('Failed to reset account:', error);
        }
    }
}));
