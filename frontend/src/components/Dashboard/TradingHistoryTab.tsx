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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Download, Upload, Wallet, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, BarChart3, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import {
    syncHistory,
    getAccountBalance,
    getHistoryOrders,
    exportHistoryCSV,
    importHistoryCSV,
    getFuturesPnL,
    type HistoryOrder,
    type BalanceAsset,
    type ImportResult,
    type FuturesPnLRecord
} from '../../services/api';

const TradingHistoryTab: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<{ orders: number; trades: number; bills: number; futures_tax: number } | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [balances, setBalances] = useState<Record<string, BalanceAsset>>({});
    const [orders, setOrders] = useState<HistoryOrder[]>([]);
    const [futuresPnL, setFuturesPnL] = useState<FuturesPnLRecord[]>([]);
    const [futuresPnLTotal, setFuturesPnLTotal] = useState(0);

    // Futures PnL Filters & Pagination
    const [pnlPage, setPnlPage] = useState(0);
    const [pnlPageSize] = useState(25);
    const [symbolFilter, setSymbolFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [allSymbols, setAllSymbols] = useState<string[]>([]);
    const [pnlLoading, setPnlLoading] = useState(false);

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
            // Load initial PnL data and get all symbols
            await loadFuturesPnL();
            // Get all records once to extract unique symbols
            const allPnl = await getFuturesPnL(1000, 0).catch(() => ({ records: [], total: 0 }));
            const symbols = [...new Set(allPnl.records.map(r => r.symbol))].sort();
            setAllSymbols(symbols);
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadFuturesPnL = useCallback(async () => {
        setPnlLoading(true);
        try {
            const pnlData = await getFuturesPnL(
                pnlPageSize,
                pnlPage * pnlPageSize,
                symbolFilter || undefined,
                typeFilter || undefined
            );
            setFuturesPnL(pnlData.records);
            setFuturesPnLTotal(pnlData.total);
        } catch (err) {
            console.error('Failed to load PnL', err);
        } finally {
            setPnlLoading(false);
        }
    }, [pnlPage, pnlPageSize, symbolFilter, typeFilter]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reload PnL when filters/page change
    useEffect(() => {
        if (!loading) {
            loadFuturesPnL();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pnlPage, symbolFilter, typeFilter]);

    const TAX_TYPES = ['open_long', 'open_short', 'close_long', 'close_short', 'liquidation_long', 'liquidation_short'];
    const totalPages = Math.ceil(futuresPnLTotal / pnlPageSize);

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            // Sync 540 days for Futures Tax API (18 months), 90 days for regular API
            const result = await syncHistory(540);
            setSyncResult({
                orders: result.orders,
                trades: result.trades,
                bills: result.bills,
                futures_tax: result.futures_tax
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

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError(null);
        setImportResult(null);
        setSyncResult(null);

        try {
            const result = await importHistoryCSV(file);
            setImportResult(result);
            // Reload data after import
            await loadData();
        } catch (err: any) {
            setError(err.message || 'Import failed');
        } finally {
            setImporting(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
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
                        disabled={syncing || importing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={syncing || importing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Upload className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} />
                        {importing ? 'Importing...' : 'Import CSV'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />
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
                    Synced: {syncResult.orders} orders, {syncResult.trades} trades, {syncResult.bills} bills, {syncResult.futures_tax} futures PnL records
                </div>
            )}

            {/* Import Result */}
            {importResult && (
                <div className={`flex items-center gap-2 p-4 rounded-lg ${importResult.success ? 'bg-green-900/30 border border-green-700 text-green-400' : 'bg-yellow-900/30 border border-yellow-700 text-yellow-400'}`}>
                    <CheckCircle className="w-5 h-5" />
                    CSV Import: {importResult.imported} imported, {importResult.skipped} skipped (of {importResult.total_rows} rows)
                    {importResult.errors.length > 0 && ` — ${importResult.errors.length} errors`}
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

            {/* Futures PnL Records */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                {/* Header with title and count */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-500" />
                        <h3 className="text-lg font-semibold text-white">Futures PnL Records</h3>
                        <span className="text-sm text-gray-400">({futuresPnLTotal} records)</span>
                        {pnlLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">Filters:</span>
                    </div>

                    {/* Symbol Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">Symbol:</label>
                        <select
                            value={symbolFilter}
                            onChange={(e) => { setSymbolFilter(e.target.value); setPnlPage(0); }}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="">All Pairs</option>
                            {allSymbols.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">Type:</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPnlPage(0); }}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="">All Types</option>
                            {TAX_TYPES.map(t => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear Filters */}
                    {(symbolFilter || typeFilter) && (
                        <button
                            onClick={() => { setSymbolFilter(''); setTypeFilter(''); setPnlPage(0); }}
                            className="text-sm text-purple-400 hover:text-purple-300"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : futuresPnL.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                        No Futures PnL records found. {symbolFilter || typeFilter ? 'Try different filters.' : 'Import CSV or Sync to fetch data.'}
                    </p>
                ) : (
                    <>
                        {/* Scrollable Table */}
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-gray-700 rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-900/50 text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="py-2 px-2 text-left">Date</th>
                                        <th className="py-2 px-2 text-left">Symbol</th>
                                        <th className="py-2 px-2 text-left">Type</th>
                                        <th className="py-2 px-2 text-right">Amount</th>
                                        <th className="py-2 px-2 text-right">Fee</th>
                                        <th className="py-2 px-2 text-left">Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {futuresPnL.map((record) => {
                                        const isProfit = record.amount > 0;
                                        const isLoss = record.amount < 0;
                                        const isOpen = record.tax_type.includes('open');
                                        const isLiquidation = record.tax_type.includes('liquidation');

                                        const getTypeBadge = () => {
                                            if (isLiquidation) return 'bg-red-600 text-white';
                                            if (record.tax_type.includes('close_long') || record.tax_type.includes('close_short')) {
                                                return isProfit ? 'bg-green-600 text-white' : 'bg-red-500 text-white';
                                            }
                                            if (record.tax_type.includes('open_long')) return 'bg-blue-600 text-white';
                                            if (record.tax_type.includes('open_short')) return 'bg-orange-600 text-white';
                                            return 'bg-gray-600 text-white';
                                        };

                                        const formatType = (type: string) => {
                                            return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                        };

                                        return (
                                            <tr key={record.id} className="hover:bg-gray-700/30">
                                                <td className="py-3 px-2 text-gray-300">
                                                    {new Date(record.recorded_at).toLocaleDateString()}<br />
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(record.recorded_at).toLocaleTimeString()}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 font-mono text-white">{record.symbol}</td>
                                                <td className="py-3 px-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadge()}`}>
                                                        {formatType(record.tax_type)}
                                                    </span>
                                                </td>
                                                <td className={`py-3 px-2 text-right font-mono font-semibold ${isOpen ? 'text-gray-400' :
                                                        isProfit ? 'text-green-400' :
                                                            isLoss ? 'text-red-400' : 'text-gray-400'
                                                    }`}>
                                                    {isOpen ? record.amount.toFixed(2) :
                                                        (isProfit ? '+' : '') + record.amount.toFixed(4)}
                                                    {!isOpen && ' USDT'}
                                                </td>
                                                <td className="py-3 px-2 text-right font-mono text-gray-400">
                                                    {record.fee ? record.fee.toFixed(4) : '-'}
                                                </td>
                                                <td className="py-3 px-2 text-gray-400">{record.margin_coin}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-4 text-sm">
                            <div className="text-gray-400">
                                Showing {pnlPage * pnlPageSize + 1} - {Math.min((pnlPage + 1) * pnlPageSize, futuresPnLTotal)} of {futuresPnLTotal}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPnlPage(p => Math.max(0, p - 1))}
                                    disabled={pnlPage === 0}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Prev
                                </button>
                                <span className="text-gray-400 px-2">
                                    Page {pnlPage + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPnlPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={pnlPage >= totalPages - 1}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TradingHistoryTab;
