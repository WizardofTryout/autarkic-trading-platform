/**
 * Trading History Tab - User Dashboard Component
 * 
 * Displays:
 * - Account balance from Bitget
 * - Synced order history
 * - Synced trade fills
 * - Sync button to fetch latest data
 * - Export CSV button for tax reporting
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Wallet, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import {
    syncHistory,
    getAccountBalance,
    getHistoryOrders,
    exportHistoryCSV,
    type HistoryOrder,
    type BalanceAsset
} from '../../services/api';

const TradingHistoryTab: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<{ orders: number; trades: number; bills: number } | null>(null);

    const [balances, setBalances] = useState<Record<string, BalanceAsset>>({});
    const [orders, setOrders] = useState<HistoryOrder[]>([]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [balanceData, orderData] = await Promise.all([
                getAccountBalance().catch(() => ({})),
                getHistoryOrders(50, 0).catch(() => [])
            ]);
            setBalances(balanceData);
            setOrders(orderData);
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            const result = await syncHistory(90);
            setSyncResult({
                orders: result.orders,
                trades: result.trades,
                bills: result.bills
            });
            // Reload data after sync
            await loadData();
        } catch (err: any) {
            setError(err.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await exportHistoryCSV();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bitget_trades_${new Date().getFullYear()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            setError(err.message || 'Export failed');
        }
    };

    const formatCurrency = (value: number) => {
        if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return value.toFixed(8);
    };

    const getTopBalances = () => {
        return Object.entries(balances)
            .filter(([_, asset]) => asset.total > 0)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10);
    };

    const getSideColor = (side: string) => {
        return side.toLowerCase() === 'buy' ? 'text-green-400' : 'text-red-400';
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'filled':
                return <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Filled</span>;
            case 'cancelled':
            case 'canceled':
                return <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs">Cancelled</span>;
            case 'partially_filled':
                return <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded text-xs">Partial</span>;
            default:
                return <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Trading History</h2>
                    <p className="text-gray-400 text-sm">Synced from Bitget Exchange</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Sync Result */}
            {syncResult && (
                <div className="flex items-center gap-2 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    Synced: {syncResult.orders} orders, {syncResult.trades} trades, {syncResult.bills} bills
                </div>
            )}

            {/* Balance Cards */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Wallet className="w-5 h-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold text-white">Account Balance</h3>
                </div>

                {loading ? (
                    <div className="text-gray-400">Loading balances...</div>
                ) : getTopBalances().length === 0 ? (
                    <div className="text-gray-500 italic">No balances found. Click "Sync Now" to fetch from Bitget.</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {getTopBalances().map(([coin, asset]) => (
                            <div key={coin} className="bg-gray-900 rounded-lg p-4">
                                <div className="font-bold text-white text-lg">{coin}</div>
                                <div className="text-2xl font-mono text-green-400">
                                    {formatCurrency(asset.total)}
                                </div>
                                <div className="text-xs text-gray-500">
                                    Available: {formatCurrency(asset.free)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Orders Table */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-white">Order History</h3>
                    <span className="text-gray-500 text-sm">({orders.length} orders)</span>
                </div>

                {loading ? (
                    <div className="text-gray-400">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="text-gray-500 italic">No orders found. Click "Sync Now" to fetch from Bitget.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-gray-400 border-b border-gray-700">
                                <tr>
                                    <th className="text-left py-3 px-2">Date</th>
                                    <th className="text-left py-3 px-2">Symbol</th>
                                    <th className="text-left py-3 px-2">Side</th>
                                    <th className="text-left py-3 px-2">Type</th>
                                    <th className="text-right py-3 px-2">Price</th>
                                    <th className="text-right py-3 px-2">Size</th>
                                    <th className="text-right py-3 px-2">Filled</th>
                                    <th className="text-right py-3 px-2">Fee</th>
                                    <th className="text-center py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-white">
                                {orders.map((order) => (
                                    <tr key={order.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                        <td className="py-3 px-2 text-gray-400">
                                            {new Date(order.created_at).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-2 font-mono">{order.symbol}</td>
                                        <td className={`py-3 px-2 font-semibold ${getSideColor(order.side)}`}>
                                            <span className="flex items-center gap-1">
                                                {order.side.toLowerCase() === 'buy' ?
                                                    <TrendingUp className="w-3 h-3" /> :
                                                    <TrendingDown className="w-3 h-3" />}
                                                {order.side.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-gray-400">{order.order_type}</td>
                                        <td className="py-3 px-2 text-right font-mono">
                                            {order.avg_fill_price ? order.avg_fill_price.toFixed(2) : '-'}
                                        </td>
                                        <td className="py-3 px-2 text-right font-mono">{order.size}</td>
                                        <td className="py-3 px-2 text-right font-mono">{order.filled_size}</td>
                                        <td className="py-3 px-2 text-right text-gray-400">
                                            {order.total_fee ? `${order.total_fee.toFixed(6)} ${order.fee_currency || ''}` : '-'}
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            {getStatusBadge(order.status)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradingHistoryTab;
