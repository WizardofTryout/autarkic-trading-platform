import React, { useState } from 'react';
import { TrendingUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import AdvancedFinancialChart from './D3Chart';

interface TradingChartWithToolsProps {
    data: any[];
    height?: number;
    showIndicators?: boolean;
    showVolume?: boolean;
    showRSI?: boolean;
    showBollingerBands?: boolean;
    showMACD?: boolean;
    symbol?: string;
    timeframe?: string;
}

const TradingChartWithTools: React.FC<TradingChartWithToolsProps> = (props) => {
    const [showFVG, setShowFVG] = useState(false);
    const [activeTool, setActiveTool] = useState<string | null>(null);

    return (
        <div className="relative">
            {/* Chart Toolbar */}
            <div className="absolute left-4 top-20 z-10 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 flex flex-col gap-2">
                {/* Trendline Tool */}
                <button
                    onClick={() => setActiveTool(activeTool === 'trendline' ? null : 'trendline')}
                    className={`p-2 rounded transition-colors group relative ${activeTool === 'trendline'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                    title="Trendline"
                >
                    <TrendingUp className="w-5 h-5" />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        Trendline
                    </div>
                </button>

                {/* Divider */}
                <div className="h-px bg-gray-700 my-1" />

                {/* FVG Toggle */}
                <button
                    onClick={() => setShowFVG(!showFVG)}
                    className={`p-2 rounded transition-colors group relative ${showFVG
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                    title="Fair Value Gaps"
                >
                    {showFVG ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        {showFVG ? 'Hide' : 'Show'} FVG
                    </div>
                </button>

                {/* Clear All */}
                <button
                    onClick={() => setActiveTool(null)}
                    className="p-2 rounded text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors group relative"
                    title="Clear All"
                >
                    <Trash2 className="w-5 h-5" />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        Clear All
                    </div>
                </button>

                {/* Status Indicator */}
                {activeTool && (
                    <div className="mt-2 px-2 py-1 bg-blue-900/50 rounded text-xs text-blue-300">
                        {activeTool === 'trendline' ? '📈 Drawing Mode' : ''}
                    </div>
                )}
                {showFVG && (
                    <div className="mt-2 px-2 py-1 bg-purple-900/50 rounded text-xs text-purple-300">
                        👁️ FVG Active
                    </div>
                )}
            </div>

            {/* Original D3 Chart */}
            <AdvancedFinancialChart {...props} />
        </div>
    );
};

export default TradingChartWithTools;
