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
    is_trailing_stop?: boolean;
    trailing_percent?: number;
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
    currentPrice: number | null; // Added currentPrice
    currentAnalysis: string | null;
    portfolio: Portfolio | null;
    activeStrategies: any[]; // Using any[] for now to avoid circular dependency with api.ts types
    chartBackgroundColor: string; // Chart background color preference
    chartTextColor: string; // Chart text color preference

    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;
    setCurrentPrice: (price: number) => void;
    setCurrentAnalysis: (analysis: string | null) => void;
    setChartBackgroundColor: (color: string) => void;
    setChartTextColor: (color: string) => void;

    fetchPortfolio: () => Promise<void>;
    fetchActiveStrategies: () => Promise<void>;
    placeOrder: (symbol: string, side: 'buy' | 'sell', amount: number, leverage: number, type?: 'MARKET' | 'LIMIT', price?: number, stopLoss?: number, takeProfit?: number, isTrailingStop?: boolean, trailingPercent?: number) => Promise<void>;
    resetAccount: () => Promise<void>;
}

// Load saved chart colors from localStorage
const savedChartBgColor = typeof window !== 'undefined'
    ? localStorage.getItem('chartBackgroundColor') || '#111827'
    : '#111827';

const savedChartTextColor = typeof window !== 'undefined'
    ? localStorage.getItem('chartTextColor') || '#9CA3AF'
    : '#9CA3AF';

export const useTradingStore = create<TradingState>((set, get) => ({
    symbol: 'BTC/USDT',
    timeframe: '1h',
    currentPrice: null,
    currentAnalysis: null,
    portfolio: null,
    activeStrategies: [],
    chartBackgroundColor: savedChartBgColor,
    chartTextColor: savedChartTextColor,

    setSymbol: (symbol) => set({ symbol }),
    setTimeframe: (timeframe) => set({ timeframe }),
    setCurrentPrice: (price) => set({ currentPrice: price }),
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    setChartBackgroundColor: (color) => {
        localStorage.setItem('chartBackgroundColor', color);
        set({ chartBackgroundColor: color });
    },
    setChartTextColor: (color) => {
        localStorage.setItem('chartTextColor', color);
        set({ chartTextColor: color });
    },

    fetchPortfolio: async () => {
        try {
            const data = await api.get('/paper/dashboard');
            set({ portfolio: data });
        } catch (error) {
            console.error('Failed to fetch portfolio:', error);
            set({ portfolio: null });
        }
    },

    fetchActiveStrategies: async () => {
        try {
            const data = await api.get('/strategies/active');
            set({ activeStrategies: data });
        } catch (error) {
            console.error('Failed to fetch active strategies:', error);
            set({ activeStrategies: [] });
        }
    },

    placeOrder: async (symbol, side, amount, leverage, type = 'MARKET', price, stopLoss, takeProfit, isTrailingStop, trailingPercent) => {
        try {
            await api.post('/paper/order', {
                symbol,
                side: side.toUpperCase(),
                amount,
                leverage,
                type,
                price,
                stop_loss: stopLoss,
                take_profit: takeProfit,
                is_trailing_stop: isTrailingStop,
                trailing_percent: trailingPercent
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
