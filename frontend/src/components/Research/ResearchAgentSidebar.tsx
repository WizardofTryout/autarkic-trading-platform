import React, { useState } from 'react';
import { Send, TrendingUp, Newspaper, Loader2 } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';

interface ResearchAgentSidebarProps {
    onAnalyze: (promptType: 'trend' | 'news' | 'custom', customPrompt?: string) => void;
    onStop: () => void;
    isAnalyzing: boolean;
}

export const ResearchAgentSidebar: React.FC<ResearchAgentSidebarProps> = ({ onAnalyze, onStop, isAnalyzing }) => {
    const { symbol, timeframe, setTimeframe } = useTradingStore();
    const [customPrompt, setCustomPrompt] = useState('');

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customPrompt.trim()) {
            onAnalyze('custom', customPrompt);
            setCustomPrompt('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4 gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-blue-400">Research Agent</h2>
                <div className="text-sm text-gray-400">
                    Analyzing <span className="font-mono text-white">{symbol}</span>
                </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-500 uppercase">Timeframe</label>
                <div className="grid grid-cols-4 gap-2">
                    {['1s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${timeframe === tf
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
                <label className="text-xs font-medium text-gray-500 uppercase">Quick Analysis</label>

                <button
                    onClick={() => onAnalyze('trend')}
                    disabled={isAnalyzing}
                    className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-medium text-sm">Trend Analysis</span>
                        <span className="text-xs text-gray-500">Techs, RSI, MACD</span>
                    </div>
                </button>

                <button
                    onClick={() => onAnalyze('news')}
                    disabled={isAnalyzing}
                    className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                        <Newspaper className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-medium text-sm">News Summary</span>
                        <span className="text-xs text-gray-500">Recent events & catalysts</span>
                    </div>
                </button>
            </div>

            {/* Custom Prompt */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
                <label className="text-xs font-medium text-gray-500 uppercase">Custom Inquiry</label>
                <form onSubmit={handleCustomSubmit} className="flex-1 flex flex-col gap-2">
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Ask anything about this asset..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
                        // Keep enabled to allow typing next query while thinking, or disable if strict sequential
                        // User requested it NOT to disappear. Disabling is fine, hiding is not.
                        disabled={isAnalyzing}
                    />

                    {isAnalyzing ? (
                        <button
                            type="button"
                            onClick={onStop}
                            className="flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg font-medium transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Stop Generating
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!customPrompt.trim()}
                            className="flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4" />
                            Ask Agent
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};
