import React, { useState, useEffect } from 'react';
import { Play, Loader } from 'lucide-react';
import { runBacktest, getStrategies, getSymbols, type Strategy } from '../../services/api';
import BacktestMetrics from './BacktestMetrics';
import EquityChart from './EquityChart';
import TradeList from './TradeList';
import SearchableSelect from '../Common/SearchableSelect';

interface BacktestPanelProps {
    script: string;  // Pine Script (for backward compatibility)
    pythonCode?: string;  // AI-generated Python code
    symbol: string;
}

const BacktestPanel: React.FC<BacktestPanelProps> = ({ script, pythonCode, symbol }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Default to last 30 days
    const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [initialCapital, setInitialCapital] = useState(10000);
    const [timeframe, setTimeframe] = useState('1h');
    const [backtestSymbol, setBacktestSymbol] = useState(symbol || 'BTC/USDT');

    // Risk Management
    const [takeProfit, setTakeProfit] = useState<number>(0); // 0 = disabled
    const [stopLoss, setStopLoss] = useState<number>(0); // 0 = disabled

    // Data for dropdowns
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [symbols, setSymbols] = useState<string[]>([]);
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>(''); // '' means current editor script

    // Update local symbol state when prop changes, but only if user hasn't manually changed it? 
    // Or just let user override. Let's sync it initially.
    useEffect(() => {
        if (symbol) setBacktestSymbol(symbol);
    }, [symbol]);

    useEffect(() => {
        getStrategies().then(setStrategies).catch(console.error);
        getSymbols().then(setSymbols).catch(console.error);
    }, []);

    const handleRunBacktest = async () => {
        // Determine which code to use
        let codeToRun = pythonCode;
        let selectedPythonCode = '';

        if (selectedStrategyId) {
            const selected = strategies.find(s => s.id === selectedStrategyId);
            if (selected) {
                selectedPythonCode = selected.python_code || '';
                codeToRun = selectedPythonCode;
            }
        }

        // Validation: Python code must exist
        if (!codeToRun) {
            setError(
                "No Python code available. Please click 'Generate Engine' in the Pine Script Editor first to transpile your strategy to Python."
            );
            return;
        }

        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const data = await runBacktest({
                python_code: codeToRun,  // Changed from 'script' to 'python_code'
                symbol: backtestSymbol,
                timeframe,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                initial_capital: initialCapital,
                take_profit: takeProfit,
                stop_loss: stopLoss
            });

            if (data.error) {
                setError(data.error);
            } else {
                setResults(data);
            }
        } catch (err: any) {
            setError(err.message || "Backtest failed");
        } finally {
            setIsLoading(false);
        }
    };

    const strategyOptions = [
        { id: '', label: 'Current Editor Script' },
        ...strategies.map(s => ({ id: s.id, label: s.name }))
    ];

    const symbolOptions = symbols.map(s => ({ id: s, label: s }));

    return (
        <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-4 overflow-y-auto">
            {/* Controls */}
            <div className="flex flex-col gap-4 mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">

                {/* Strategy Selection Row */}
                <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
                    <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Strategy Source</label>
                        <SearchableSelect
                            options={strategyOptions}
                            value={selectedStrategyId}
                            onChange={setSelectedStrategyId}
                            placeholder="Select Strategy..."
                            searchPlaceholder="Search strategies..."
                        />
                    </div>
                </div>

                {/* Parameters Row 1 */}
                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Symbol</label>
                        <SearchableSelect
                            options={symbolOptions}
                            value={backtestSymbol}
                            onChange={setBacktestSymbol}
                            placeholder="Select Symbol..."
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Timeframe</label>
                        <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="1m">1 Minute</option>
                            <option value="5m">5 Minutes</option>
                            <option value="15m">15 Minutes</option>
                            <option value="1h">1 Hour</option>
                            <option value="4h">4 Hours</option>
                            <option value="1d">1 Day</option>
                        </select>
                    </div>
                </div>

                {/* Parameters Row 2: Capital & Risk */}
                <div className="grid grid-cols-4 gap-4 pt-2 border-t border-gray-700">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Initial Capital ($)</label>
                        <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Take Profit (%)</label>
                        <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(Number(e.target.value))}
                            placeholder="0 (Disabled)"
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Stop Loss (%)</label>
                        <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(Number(e.target.value))}
                            placeholder="0 (Disabled)"
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleRunBacktest}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center"
                        >
                            {isLoading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Run Backtest
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-6">
                    <BacktestMetrics metrics={results.metrics} />
                    <EquityChart data={results.equity_curve} />
                    <TradeList trades={results.trades} />
                </div>
            )}

            {!results && !isLoading && !error && (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p>Configure settings and click "Run Backtest" to see results.</p>
                </div>
            )}
        </div>
    );
};

export default BacktestPanel;
