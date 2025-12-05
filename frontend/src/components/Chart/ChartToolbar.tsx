import React from 'react';
import {
    TrendingUp,
    Pencil,
    Square,
    Circle,
    Type,
    Trash2,
    Eye,
    EyeOff
} from 'lucide-react';

interface ChartToolbarProps {
    activeTool: string | null;
    onToolSelect: (tool: string | null) => void;
    showFVG: boolean;
    onToggleFVG: () => void;
}

const ChartToolbar: React.FC<ChartToolbarProps> = ({
    activeTool,
    onToolSelect,
    showFVG,
    onToggleFVG
}) => {
    const tools = [
        { id: 'trendline', icon: TrendingUp, label: 'Trendline' },
        { id: 'horizontal', icon: Pencil, label: 'Horizontal Line' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'text', icon: Type, label: 'Text' },
    ];

    return (
        <div className="absolute left-4 top-20 z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 flex flex-col gap-2">
            {/* Drawing Tools */}
            {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;

                return (
                    <button
                        key={tool.id}
                        onClick={() => onToolSelect(isActive ? null : tool.id)}
                        className={`p-2 rounded transition-colors group relative ${isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                        title={tool.label}
                    >
                        <Icon className="w-5 h-5" />

                        {/* Tooltip */}
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            {tool.label}
                        </div>
                    </button>
                );
            })}

            {/* Divider */}
            <div className="h-px bg-gray-700 my-1" />

            {/* FVG Toggle */}
            <button
                onClick={onToggleFVG}
                className={`p-2 rounded transition-colors group relative ${showFVG
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                title="Fair Value Gaps"
            >
                {showFVG ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}

                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    {showFVG ? 'Hide' : 'Show'} Fair Value Gaps
                </div>
            </button>

            {/* Clear All */}
            <button
                onClick={() => onToolSelect('clear')}
                className="p-2 rounded text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors group relative"
                title="Clear All Drawings"
            >
                <Trash2 className="w-5 h-5" />

                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    Clear All Drawings
                </div>
            </button>
        </div>
    );
};

export default ChartToolbar;
