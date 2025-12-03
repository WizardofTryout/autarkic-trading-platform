import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Play, Code, MessageSquare, Layout } from 'lucide-react';
import PineScriptPanel from '../PineScriptPanel';
import BacktestPanel from '../Backtest/BacktestPanel';
import ChatPanel from '../AIAssistant/ChatPanel';
import StrategyActivationModal from './StrategyActivationModal';
import { getStrategies, createStrategy, updateStrategy, deleteStrategy, getActiveStrategies, stopStrategy } from '../../services/api';
import type { Strategy, ActiveStrategy } from '../../services/api';

const StrategyBuilderView: React.FC = () => {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [activeStrategies, setActiveStrategies] = useState<ActiveStrategy[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
    const [currentCode, setCurrentCode] = useState('//@version=5\nstrategy("My Strategy", overlay=true)\n\n// Your code here');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [showActivationModal, setShowActivationModal] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStrategies();
        loadActiveStrategies();
    }, []);

    const loadStrategies = async () => {
        try {
            const data = await getStrategies();
            setStrategies(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadActiveStrategies = async () => {
        try {
            const data = await getActiveStrategies();
            setActiveStrategies(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNewStrategy = () => {
        setSelectedStrategy(null);
        setCurrentCode('//@version=5\nstrategy("New Strategy", overlay=true)\n\n// Start coding...');
    };

    const handleSelectStrategy = (strategy: Strategy) => {
        setSelectedStrategy(strategy);
        setCurrentCode(strategy.source_code);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Extract name from code
            const nameMatch = currentCode.match(/strategy\("([^"]+)"/);
            const name = nameMatch ? nameMatch[1] : (selectedStrategy?.name || "New Strategy");

            if (selectedStrategy) {
                await updateStrategy(selectedStrategy.id, {
                    name,
                    source_code: currentCode
                });
            } else {
                const newStrat = await createStrategy({
                    name,
                    source_code: currentCode,
                    category: 'Personal'
                });
                setSelectedStrategy(newStrat);
            }
            await loadStrategies();
        } catch (err) {
            console.error(err);
            alert('Failed to save strategy');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await deleteStrategy(id);
            if (selectedStrategy?.id === id) handleNewStrategy();
            await loadStrategies();
        } catch (err) {
            console.error(err);
        }
    };

    const handleStop = async (activeId: string) => {
        try {
            await stopStrategy(activeId);
            await loadActiveStrategies();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
            {/* Sidebar: Strategy List */}
            <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                        <Layout className="w-4 h-4 text-blue-400" />
                        Strategies
                    </h2>
                    <button onClick={handleNewStrategy} className="p-1 hover:bg-gray-800 rounded text-blue-400">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {strategies.map(s => (
                        <div
                            key={s.id}
                            onClick={() => handleSelectStrategy(s)}
                            className={`p-3 rounded cursor-pointer group flex items-center justify-between ${selectedStrategy?.id === s.id ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-gray-800 border border-transparent'}`}
                        >
                            <div className="truncate">
                                <div className="font-medium text-sm text-gray-200 truncate">{s.name}</div>
                                <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Active Strategies Mini-List */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Active Runs</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {activeStrategies.filter(a => a.status === 'RUNNING').map(a => (
                            <div key={a.id} className="flex items-center justify-between text-xs bg-green-900/20 p-2 rounded border border-green-900/30">
                                <div>
                                    <div className="font-medium text-green-400">{a.symbol}</div>
                                    <div className="text-gray-500">{a.strategy_name}</div>
                                </div>
                                <button onClick={() => handleStop(a.id)} className="text-red-400 hover:text-red-300">Stop</button>
                            </div>
                        ))}
                        {activeStrategies.filter(a => a.status === 'RUNNING').length === 0 && (
                            <div className="text-xs text-gray-600 italic">No active strategies</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content: Editor */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-white">{selectedStrategy?.name || "New Strategy"}</h1>
                        {selectedStrategy && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                                {selectedStrategy.status}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Save
                        </button>
                        {selectedStrategy && (
                            <button
                                onClick={() => setShowActivationModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                Deploy
                            </button>
                        )}
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`p-2 rounded transition-colors ${isChatOpen ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <MessageSquare className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Editor & Backtest Split Area */}
                <div className="flex-1 relative flex overflow-hidden">
                    {/* Left Pane: Code Editor */}
                    <div className="flex-1 border-r border-gray-800 flex flex-col min-w-0">
                        <PineScriptPanel
                            script={currentCode}
                            onScriptChange={setCurrentCode}
                            isMaximized={true}
                        />
                    </div>

                    {/* Right Pane: Strategy Tester */}
                    <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
                        <div className="h-10 bg-gray-800/50 border-b border-gray-800 flex items-center px-4 font-medium text-sm text-gray-300">
                            <Play className="w-4 h-4 mr-2 text-blue-400" />
                            Strategy Tester
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <BacktestPanel
                                script={currentCode}
                                symbol={selectedStrategy ? 'BTC/USDT' : 'BTC/USDT'} // Default or strategy specific
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Chat */}
            {isChatOpen && (
                <div className="w-96 border-l border-gray-800 bg-gray-900 flex flex-col">
                    <ChatPanel
                        isOpen={true}
                        onClose={() => setIsChatOpen(false)}
                        currentScript={currentCode}
                        onLoadCode={setCurrentCode}
                        defaultMode="strategy"
                    />
                </div>
            )}

            {showActivationModal && selectedStrategy && (
                <StrategyActivationModal
                    strategyId={selectedStrategy.id}
                    strategyName={selectedStrategy.name}
                    onClose={() => setShowActivationModal(false)}
                    onSuccess={() => {
                        loadActiveStrategies();
                        alert('Strategy Activated!');
                    }}
                />
            )}
        </div>
    );
};

export default StrategyBuilderView;
