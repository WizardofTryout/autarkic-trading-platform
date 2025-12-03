import React, { useState, useEffect } from 'react';
import { Play, Loader } from 'lucide-react';
import { runBacktest, getStrategies, getSymbols, type Strategy } from '../../services/api';
import BacktestMetrics from './BacktestMetrics';
import EquityChart from './EquityChart';
import TradeList from './TradeList';
import SearchableSelect from '../Common/SearchableSelect';

interface BacktestPanelProps {
    script: string;
    symbol: string;
}

const BacktestPanel: React.FC<BacktestPanelProps> = ({ script, symbol }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Default to last 30 days
    const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [initialCapital, setInitialCapital] = useState(10000);
    const [timeframe, setTimeframe] = useState('1h');
    const [backtestSymbol, setBacktestSymbol] = useState(symbol || 'BTC/USDT');

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
        let scriptToRun = script;

        if (selectedStrategyId) {
            const selected = strategies.find(s => s.id === selectedStrategyId);
            if (selected) {
                scriptToRun = selected.source_code;
            }
        }

        if (!scriptToRun) {
            setError("Please enter a Pine Script strategy or select one from the list.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const data = await runBacktest({
                script: scriptToRun,
                symbol: backtestSymbol,
                timeframe,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                initial_capital: initialCapital
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

                {/* Parameters Row */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col w-48">
                        <label className="text-xs text-gray-400 mb-1">Symbol</label>
                        <SearchableSelect
                            options={symbolOptions}
                            value={backtestSymbol}
                            onChange={setBacktestSymbol}
                            placeholder="Select Symbol..."
                            searchPlaceholder="Search symbols..."
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">Timeframe</label>
                        <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="1m">1 Minute</option>
                            <option value="5m">5 Minutes</option>
                            <option value="15m">15 Minutes</option>
                            <option value="1h">1 Hour</option>
                            <option value="4h">4 Hours</option>
                            <option value="1d">1 Day</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">Initial Capital ($)</label>
                        <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
                            className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm w-32 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <button
                        onClick={handleRunBacktest}
                        disabled={isLoading}
                        className={`ml-auto flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${isLoading
                            ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/20'
                            }`}
                    >
                        {isLoading ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
                        {isLoading ? 'Running...' : 'Run Backtest'}
                    </button>
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
