import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, XCircle, RefreshCw } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { useBinanceWebSocket } from '../../hooks/useBinanceWebSocket';

export const TradingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
    const { portfolio, fetchPortfolio, resetAccount } = useTradingStore();

    // Get unique symbols from positions to subscribe to
    const symbols = React.useMemo(() => {
        if (!portfolio?.positions) return [];
        return Array.from(new Set(portfolio.positions.map(p => p.symbol)));
    }, [portfolio?.positions]);

    const { currentData } = useBinanceWebSocket(symbols, '1m'); // Timeframe doesn't matter much for price, 1m is fine

    useEffect(() => {
        fetchPortfolio();
        const interval = setInterval(fetchPortfolio, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [fetchPortfolio]);

    if (!portfolio) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                <span>Loading portfolio...</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchPortfolio()}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white transition-colors"
                    >
                        Retry
                    </button>
                    <button
                        onClick={() => resetAccount()}
                        className="px-3 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded text-xs transition-colors flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Force Reset
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">If this persists, please try logging out and back in.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 text-sm">
            {/* Tabs */}
            <div className="flex justify-between border-b border-gray-800 bg-gray-900 pr-4">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('positions')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'positions' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Positions ({portfolio.positions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'orders' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Open Orders ({portfolio.orders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Order History
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-gray-400">Balance: <span className="text-white font-bold">{portfolio.balance.toFixed(2)} USDT</span></span>
                    <button onClick={() => resetAccount()} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Reset Account
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'positions' && (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-800/50 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">Symbol</th>
                                <th className="p-3 font-medium">Size</th>
                                <th className="p-3 font-medium">Entry Price</th>
                                <th className="p-3 font-medium">Mark Price</th>
                                <th className="p-3 font-medium">Liq. Price</th>
                                <th className="p-3 font-medium">TP / SL</th>
                                <th className="p-3 font-medium">Margin</th>
                                <th className="p-3 font-medium">PnL (ROE%)</th>
                                <th className="p-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {portfolio.positions.map((pos) => {
                                // Calculate PnL locally using WebSocket data
                                const currentPrice = currentData[pos.symbol]?.close || pos.entry_price;
                                let pnl = 0;
                                if (pos.side === 'LONG') {
                                    pnl = (currentPrice - pos.entry_price) * pos.size;
                                } else {
                                    pnl = (pos.entry_price - currentPrice) * pos.size;
                                }
                                const pnlPercent = (pnl / pos.margin) * 100;

                                return (
                                    <tr key={pos.id} className="hover:bg-gray-800/30 transition-colors">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white">{pos.symbol}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${pos.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {pos.side} {pos.leverage}x
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-300">{pos.size.toFixed(4)}</td>
                                        <td className="p-3 text-gray-300">{pos.entry_price.toFixed(2)}</td>
                                        <td className="p-3 text-gray-300">{currentPrice.toFixed(2)}</td>
                                        <td className="p-3 text-orange-400">{pos.liquidation_price?.toFixed(2) || '-'}</td>
                                        <td className="p-3 text-gray-300">
                                            <div className="flex flex-col text-xs">
                                                <span className="text-green-400">TP: {pos.take_profit?.toFixed(2) || '-'}</span>
                                                <span className="text-red-400">SL: {pos.stop_loss?.toFixed(2) || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-300">{pos.margin.toFixed(2)} USDT</td>
                                        <td className="p-3">
                                            <div className={`flex items-center gap-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                <span className="font-medium">{pnl.toFixed(2)} USDT</span>
                                                <span className="text-xs opacity-80">({pnlPercent.toFixed(2)}%)</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors">
                                                Close
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {activeTab === 'orders' && (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-800/50 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">Time</th>
                                <th className="p-3 font-medium">Symbol</th>
                                <th className="p-3 font-medium">Type</th>
                                <th className="p-3 font-medium">Side</th>
                                <th className="p-3 font-medium">Price</th>
                                <th className="p-3 font-medium">Amount</th>
                                <th className="p-3 font-medium">Filled</th>
                                <th className="p-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {portfolio.orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                                    <td className="p-3 text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</td>
                                    <td className="p-3 font-bold text-white">{order.symbol}</td>
                                    <td className="p-3 text-gray-300">{order.type}</td>
                                    <td className={`p-3 ${order.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{order.side}</td>
                                    <td className="p-3 text-gray-300">{order.price?.toFixed(2) || 'Market'}</td>
                                    <td className="p-3 text-gray-300">{order.amount}</td>
                                    <td className="p-3 text-gray-300">{order.filled_quantity}</td>
                                    <td className="p-3 text-right">
                                        <button className="text-gray-400 hover:text-red-400 transition-colors">
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeTab === 'history' && (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-800/50 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">Time</th>
                                <th className="p-3 font-medium">Symbol</th>
                                <th className="p-3 font-medium">Side</th>
                                <th className="p-3 font-medium">Price</th>
                                <th className="p-3 font-medium">Filled</th>
                                <th className="p-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {portfolio.history.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                                    <td className="p-3 text-gray-400">{new Date(order.created_at).toLocaleString()}</td>
                                    <td className="p-3 font-bold text-white">{order.symbol}</td>
                                    <td className={`p-3 ${order.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{order.side}</td>
                                    <td className="p-3 text-gray-300">{order.price?.toFixed(2)}</td>
                                    <td className="p-3 text-gray-300">{order.filled_quantity}</td>
                                    <td className="p-3 text-gray-300">{order.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
