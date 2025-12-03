import React, { useState } from 'react';
import { X, Play, Loader2 } from 'lucide-react';
import { activateStrategy } from '../../services/api';

interface StrategyActivationModalProps {
    strategyId: string;
    strategyName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const StrategyActivationModal: React.FC<StrategyActivationModalProps> = ({ strategyId, strategyName, onClose, onSuccess }) => {
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [timeframe, setTimeframe] = useState('15m');
    const [amount, setAmount] = useState(1000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleActivate = async () => {
        setLoading(true);
        setError(null);
        try {
            await activateStrategy({
                strategy_id: strategyId,
                symbol,
                timeframe,
                amount
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to activate strategy');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Play className="w-5 h-5 text-green-500" />
                        Activate Strategy
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-6">
                    <p className="text-gray-400 text-sm mb-4">
                        Deploying <span className="text-white font-medium">{strategyName}</span> for automated execution.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Symbol</label>
                            <select
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                            >
                                <option value="BTC/USDT">BTC/USDT</option>
                                <option value="ETH/USDT">ETH/USDT</option>
                                <option value="SOL/USDT">SOL/USDT</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Timeframe</label>
                            <select
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                            >
                                <option value="1m">1 Minute</option>
                                <option value="5m">5 Minutes</option>
                                <option value="15m">15 Minutes</option>
                                <option value="1h">1 Hour</option>
                                <option value="4h">4 Hours</option>
                                <option value="1d">1 Day</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Investment Amount (USDT)</label>
                            <input
                                type="number"
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleActivate}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start Execution
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StrategyActivationModal;
