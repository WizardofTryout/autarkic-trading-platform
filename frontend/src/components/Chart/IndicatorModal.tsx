import React, { useState } from 'react';
import { X, Search, Star, Activity, BarChart2, Plus } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';

interface IndicatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddIndicator: (name: string, isStack: boolean) => void;
}

const MAIN_INDICATORS = [
    { name: 'MA', label: 'MA (Moving Average)', desc: 'Trend following indicator' },
    { name: 'EMA', label: 'EMA (Exponential MA)', desc: 'Weighted moving average' },
    { name: 'SMA', label: 'SMA (Simple MA)', desc: 'Simple moving average' },
    { name: 'BOLL', label: 'Bollinger Bands', desc: 'Volatility indicator' },
    { name: 'SAR', label: 'SAR (Stop and Reverse)', desc: 'Trend reversal' },
];

const SUB_INDICATORS = [
    { name: 'VOL', label: 'Volume', desc: 'Trading volume' },
    { name: 'MACD', label: 'MACD', desc: 'Momentum oscillator' },
    { name: 'RSI', label: 'RSI (Relative Strength)', desc: 'Momentum indicator' },
    { name: 'KDJ', label: 'KDJ', desc: 'Momentum indicator' },
    { name: 'CCI', label: 'CCI', desc: 'Cyclical trends' },
    { name: 'WR', label: 'Williams %R', desc: 'Momentum indicator' },
    { name: 'OBV', label: 'On Balance Volume', desc: 'Volume flow' },
    { name: 'ROC', label: 'Rate of Change', desc: 'Momentum' },
    { name: 'ATR', label: 'ATR (True Range)', desc: 'Volatility' },
];

const IndicatorModal: React.FC<IndicatorModalProps> = ({ isOpen, onClose, onAddIndicator }) => {
    const [activeTab, setActiveTab] = useState<'main' | 'sub' | 'custom' | 'favorites'>('main');
    const [searchQuery, setSearchQuery] = useState('');
    const { favorites, toggleFavorite } = useTradingStore();

    if (!isOpen) return null;

    const getIndicators = () => {
        if (activeTab === 'main') return MAIN_INDICATORS.map(i => ({ ...i, isStack: true }));
        if (activeTab === 'sub') return SUB_INDICATORS.map(i => ({ ...i, isStack: false }));
        if (activeTab === 'favorites') {
            return [
                ...MAIN_INDICATORS.map(i => ({ ...i, isStack: true })),
                ...SUB_INDICATORS.map(i => ({ ...i, isStack: false }))
            ].filter(ind => favorites?.includes(ind.name));
        }
        return [];
    };

    const displayIndicators = getIndicators()
        .filter(ind => ind.name.toLowerCase().includes(searchQuery.toLowerCase()) || (ind.label && ind.label.toLowerCase().includes(searchQuery.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Indicators & Strategies
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search & Tabs */}
                <div className="p-4 border-b border-gray-800 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search indicators..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="flex gap-2">
                        {[
                            { id: 'main', label: 'Main Chart' },
                            { id: 'sub', label: 'Sub Pane' },
                            { id: 'custom', label: 'My Strategies' },
                            { id: 'favorites', label: 'Favorites' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'custom' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <BarChart2 className="w-12 h-12 mb-4 opacity-50" />
                            <p>No custom strategies found</p>
                            <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
                                Open Strategy Builder
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {displayIndicators.map((ind) => (
                                <div
                                    key={ind.name}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 cursor-pointer group transition-colors"
                                    onClick={() => {
                                        onAddIndicator(ind.name, ind.isStack);
                                        onClose();
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(ind.name);
                                            }}
                                            className={`p-1 rounded hover:bg-gray-700 transition-colors ${favorites?.includes(ind.name) ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'
                                                }`}
                                        >
                                            <Star className="w-4 h-4" fill={favorites?.includes(ind.name) ? "currentColor" : "none"} />
                                        </button>
                                        <div>
                                            <div className="font-medium text-gray-200">{ind.label || ind.name}</div>
                                            <div className="text-xs text-gray-500">{ind.desc}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded text-gray-300 hover:text-white transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            ))}
                            {displayIndicators.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No indicators found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IndicatorModal;
