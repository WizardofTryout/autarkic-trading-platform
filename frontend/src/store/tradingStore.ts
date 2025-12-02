import { create } from 'zustand';

interface TradingState {
    symbol: string;
    timeframe: string;
    currentAnalysis: string | null;
    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;
    setCurrentAnalysis: (analysis: string | null) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
    symbol: 'BTC/USDT',
    timeframe: '1h',
    currentAnalysis: null,
    setSymbol: (symbol) => set({ symbol }),
    setTimeframe: (timeframe) => set({ timeframe }),
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
}));
