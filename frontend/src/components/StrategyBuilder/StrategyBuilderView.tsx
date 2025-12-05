import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Play, MessageSquare, Layout, Star } from 'lucide-react';
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
    const [pythonCode, setPythonCode] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [showActivationModal, setShowActivationModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; strategyId: string | null; strategyName: string }>({ show: false, strategyId: null, strategyName: '' });
    const [strategyName, setStrategyName] = useState('My Strategy');

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
        setStrategyName(strategy.name);
        setPythonCode(strategy.python_code || '');
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Use the strategyName from state (set via PineScriptPanel input)
            const name = strategyName || "New Strategy";

            if (selectedStrategy) {
                await updateStrategy(selectedStrategy.id, {
                    name,
                    source_code: currentCode,
                    python_code: pythonCode || undefined
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

    const handleDeleteClick = (id: string, name: string) => {
        setDeleteConfirm({ show: true, strategyId: id, strategyName: name });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.strategyId) return;
        try {
            await deleteStrategy(deleteConfirm.strategyId);
            if (selectedStrategy?.id === deleteConfirm.strategyId) handleNewStrategy();
            await loadStrategies();
            setDeleteConfirm({ show: false, strategyId: null, strategyName: '' });
        } catch (err) {
            console.error('Failed to delete strategy:', err);
            setDeleteConfirm({ show: false, strategyId: null, strategyName: '' });
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

    const toggleFavorite = async (e: React.MouseEvent, strategyId: string, currentStatus: boolean) => {
        e.stopPropagation();
        try {
            // Optimistic update
            setStrategies(prev => prev.map(s =>
                s.id === strategyId ? { ...s, is_favorite: !currentStatus } : s
            ));

            await updateStrategy(strategyId, { is_favorite: !currentStatus });
        } catch (error) {
            console.error('Failed to update favorite status:', error);
            // Revert on failure
            setStrategies(prev => prev.map(s =>
                s.id === strategyId ? { ...s, is_favorite: currentStatus } : s
            ));
        }
    };

    return (
        <div className="flex h-full bg-gray-950 text-gray-100 overflow-hidden">
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
                            <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <button
                                        onClick={(e) => toggleFavorite(e, s.id, s.is_favorite || false)}
                                        className={`text-gray-500 hover:text-yellow-500 transition-colors ${s.is_favorite ? 'text-yellow-500' : ''}`}
                                    >
                                        <Star size={14} fill={s.is_favorite ? "currentColor" : "none"} />
                                    </button>
                                    <div className="font-medium text-sm text-gray-200 truncate">{s.name}</div>
                                    <span className={`text-[9px] px-1 py-0.5 rounded uppercase font-bold flex-shrink-0 ${s.type === 'strategy'
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {s.type === 'strategy' ? 'STRAT' : 'IND'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 pl-6">{new Date(s.created_at).toLocaleDateString()}</div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(s.id, s.name); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400"
                            >
                                <Trash2 className="w-4 h-4" />
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
                    <div className="flex-1 border-r border-gray-800 flex flex-col min-w-0 overflow-hidden">
                        <PineScriptPanel
                            script={currentCode}
                            onScriptChange={setCurrentCode}
                            strategyName={strategyName}
                            onNameChange={setStrategyName}
                            pythonCode={pythonCode}
                            onPythonCodeChange={setPythonCode}
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
                            {selectedStrategy && selectedStrategy.type === 'indicator' ? (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center max-w-md">
                                        <div className="mb-4 text-yellow-500">
                                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Indicator Cannot Be Backtested</h3>
                                        <p className="text-gray-400 text-sm">
                                            Indicators are for display purposes only and cannot be backtested alone.
                                            To backtest, create a strategy that uses this indicator or use the Strategy Composer.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <BacktestPanel
                                    script={currentCode}
                                    pythonCode={pythonCode}
                                    symbol={selectedStrategy ? 'BTC/USDT' : 'BTC/USDT'} // Default or strategy specific
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Chat */}
            {
                isChatOpen && (
                    <div className="w-96 border-l border-gray-800 bg-gray-900 flex flex-col">
                        <ChatPanel
                            isOpen={true}
                            onClose={() => setIsChatOpen(false)}
                            currentScript={currentCode}
                            onLoadCode={setCurrentCode}
                            defaultMode="strategy"
                        />
                    </div>
                )
            }

            {
                showActivationModal && selectedStrategy && (
                    <StrategyActivationModal
                        strategyId={selectedStrategy.id}
                        strategyName={selectedStrategy.name}
                        onClose={() => setShowActivationModal(false)}
                        onSuccess={() => {
                            loadActiveStrategies();
                            alert('Strategy Activated!');
                        }}
                    />
                )
            }

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-4">Delete Strategy</h3>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete <span className="font-bold text-blue-400">{deleteConfirm.strategyName}</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, strategyId: null, strategyName: '' })}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default StrategyBuilderView;
