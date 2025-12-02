import { create } from 'zustand';

interface TradingState {
    symbol: string;
    timeframe: string;
    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
    symbol: 'BTC/USDT',
    timeframe: '1h',
    setSymbol: (symbol) => set({ symbol }),
    setTimeframe: (timeframe) => set({ timeframe }),
}));
