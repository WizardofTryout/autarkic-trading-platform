import React, { useState } from 'react';
import { X, Play, Loader2 } from 'lucide-react';
import { activateStrategy, getUserPreferences, updateUserPreferences } from '../../services/api';

interface StrategyActivationModalProps {
    strategyId: string;
    strategyName: string;
    initialData?: {
        symbol: string;
        timeframe: string;
        amount: number;
    };
    onClose: () => void;
    onSuccess: () => void;
}

const StrategyActivationModal: React.FC<StrategyActivationModalProps> = ({ strategyId, strategyName, initialData, onClose, onSuccess }) => {
    const [symbol, setSymbol] = useState(initialData?.symbol || 'BTC/USDT');
    const [availableSymbols, setAvailableSymbols] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
    const [timeframe, setTimeframe] = useState(initialData?.timeframe || '15m');
    const [amount, setAmount] = useState(initialData?.amount || 1000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Risk Management State
    const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
    const [riskRewardRatio, setRiskRewardRatio] = useState<number>(2.0);
    const [stopLossPercent, setStopLossPercent] = useState<number>(2.0);
    const [useTrailingStop, setUseTrailingStop] = useState<boolean>(false);
    const [trailingStopPercent, setTrailingStopPercent] = useState<number>(1.0);

    const [userPreferences, setUserPreferences] = useState<any>({});

    React.useEffect(() => {
        const fetchPrefs = async () => {
            try {
                const prefs = await getUserPreferences();
                setUserPreferences(prefs);
            } catch (err) {
                console.error("Failed to fetch preferences", err);
            }
        };
        fetchPrefs();
    }, []);

    React.useEffect(() => {
        if (initialData) {
            setSymbol(initialData.symbol);
            setTimeframe(initialData.timeframe);
            setAmount(initialData.amount);
        }
    }, [strategyId]);

    // Apply preferences when symbol changes (if no initial data override)
    React.useEffect(() => {
        if (userPreferences && userPreferences[symbol]) {
            const prefs = userPreferences[symbol];
            if (prefs.timeframe) setTimeframe(prefs.timeframe);
            if (prefs.amount) setAmount(prefs.amount);
            if (prefs.riskPerTrade) setRiskPerTrade(prefs.riskPerTrade);
            if (prefs.riskRewardRatio) setRiskRewardRatio(prefs.riskRewardRatio);
            if (prefs.stopLossPercent) setStopLossPercent(prefs.stopLossPercent);
            if (prefs.useTrailingStop !== undefined) setUseTrailingStop(prefs.useTrailingStop);
            if (prefs.trailingStopPercent) setTrailingStopPercent(prefs.trailingStopPercent);
        }
    }, [symbol, userPreferences]);

    React.useEffect(() => {
        const fetchSymbols = async () => {
            try {
                // Dynamically import to avoid circular dependency if any
                const { getSymbols } = await import('../../services/api');
                const symbols = await getSymbols();
                if (symbols && symbols.length > 0) {
                    setAvailableSymbols(symbols);
                    // Default to BTC/USDT if available, else first one
                    if (!symbols.includes(symbol)) {
                        setSymbol(symbols[0]);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch symbols", err);
            }
        };
        fetchSymbols();
    }, []);

    const handleActivate = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Activate Strategy
            await activateStrategy({
                strategy_id: strategyId,
                symbol,
                timeframe,
                amount,
                risk_per_trade: riskPerTrade / 100, // Convert to decimal
                risk_reward_ratio: riskRewardRatio,
                stop_loss_percent: stopLossPercent / 100, // Convert to decimal
                use_trailing_stop: useTrailingStop,
                trailing_stop_percent: useTrailingStop ? trailingStopPercent / 100 : undefined
            });

            // 2. Save Preferences
            const newPrefs = {
                ...userPreferences,
                [symbol]: {
                    timeframe,
                    amount,
                    riskPerTrade,
                    riskRewardRatio,
                    stopLossPercent,
                    useTrailingStop,
                    trailingStopPercent
                }
            };
            await updateUserPreferences(newPrefs);

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Activation Error:", err);
            setError(err.message || 'Failed to activate strategy. Check console for details.');
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
                        <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">Symbol</label>
                            <div
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white cursor-pointer flex items-center justify-between"
                                onClick={() => setIsOpen(!isOpen)}
                            >
                                <span>{symbol}</span>
                                <span className="text-gray-500 text-xs">▼</span>
                            </div>

                            {isOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50 max-h-60 flex flex-col">
                                    <div className="p-2 border-b border-gray-700">
                                        <input
                                            type="text"
                                            className="w-full bg-gray-900 text-white px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Search..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        {availableSymbols
                                            .filter(s => s.toLowerCase().includes(search.toLowerCase()))
                                            .map(s => (
                                                <div
                                                    key={s}
                                                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-700 transition-colors ${s === symbol ? 'bg-blue-900/30 text-blue-400' : 'text-gray-300'}`}
                                                    onClick={() => {
                                                        setSymbol(s);
                                                        setIsOpen(false);
                                                        setSearch('');
                                                    }}
                                                >
                                                    {s}
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {isOpen && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsOpen(false)}
                                />
                            )}
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Risk per Trade (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="1.0"
                                    onChange={(e) => setRiskPerTrade(parseFloat(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Risk/Reward Ratio</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="2.0"
                                    onChange={(e) => setRiskRewardRatio(parseFloat(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Stop Loss (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="2.0"
                                    onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    type="checkbox"
                                    id="trailing"
                                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                    checked={useTrailingStop}
                                    onChange={(e) => setUseTrailingStop(e.target.checked)}
                                />
                                <label htmlFor="trailing" className="text-sm text-gray-300">Trailing Stop</label>
                            </div>
                        </div>

                        {useTrailingStop && (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Trailing Stop (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="1.0"
                                    onChange={(e) => setTrailingStopPercent(parseFloat(e.target.value))}
                                />
                            </div>
                        )}
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
