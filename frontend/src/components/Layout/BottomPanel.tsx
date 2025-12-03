import React, { useState } from 'react';
import { Terminal, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { TradingDashboard } from '../Dashboard/TradingDashboard';
import PineScriptPanel from '../PineScriptPanel';

interface BottomPanelProps {
    onScriptChange: (script: string) => void;
    script?: string;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ onScriptChange, script }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'editor'>('dashboard');
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className={`flex flex-col bg-gray-900 border-t border-gray-800 transition-all duration-300 ${isExpanded ? 'h-1/3' : 'h-10'}`}>
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-2 bg-gray-800/50 border-b border-gray-800 h-10 flex-none">
                <div className="flex gap-1">
                    <button
                        onClick={() => { setActiveTab('dashboard'); setIsExpanded(true); }}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${activeTab === 'dashboard' && isExpanded ? 'bg-gray-900 text-blue-400 border-t border-x border-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        <Activity className="w-4 h-4" />
                        Dashboard
                    </button>
                    <button
                        onClick={() => { setActiveTab('editor'); setIsExpanded(true); }}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${activeTab === 'editor' && isExpanded ? 'bg-gray-900 text-blue-400 border-t border-x border-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        <Terminal className="w-4 h-4" />
                        Pine Editor
                    </button>
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
            </div>

            {/* Content Area */}
            {isExpanded && (
                <div className="flex-1 overflow-hidden bg-gray-900 relative">
                    {activeTab === 'dashboard' ? (
                        <TradingDashboard />
                    ) : (
                        <PineScriptPanel onScriptChange={onScriptChange} script={script} />
                    )}
                </div>
            )}
        </div>
    );
};
