import React, { useState, useEffect } from 'react';
import { ApprovalModal } from './ApprovalModal';
import { useTradingStore } from '../store/tradingStore';
import { Wallet } from 'lucide-react';

export const OrderEntry: React.FC = () => {
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [price, setPrice] = useState('');
    const [margin, setMargin] = useState('');
    const [leverage, setLeverage] = useState('10');

    // TP/SL State
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [takeProfit, setTakeProfit] = useState('');
    const [stopLoss, setStopLoss] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingSide, setPendingSide] = useState<'buy' | 'sell' | null>(null);

    const { placeOrder, symbol, portfolio, fetchPortfolio } = useTradingStore();

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    // Reset state when symbol changes
    useEffect(() => {
        setPrice('');
        setMargin('');
        setTpEnabled(false);
        setSlEnabled(false);
        setTakeProfit('');
        setStopLoss('');
        setOrderType('MARKET');
    }, [symbol]);

    const handleOrderClick = (side: 'buy' | 'sell') => {
        if (!margin) return;
        if (orderType === 'LIMIT' && !price) return;
        setPendingSide(side);
        setIsModalOpen(true);
    };

    const handleConfirm = async () => {
        if (!pendingSide) return;

        try {
            await placeOrder(
                symbol,
                pendingSide,
                parseFloat(margin),
                parseInt(leverage),
                orderType,
                orderType === 'LIMIT' ? parseFloat(price) : undefined,
                slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
                tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined
            );
            console.log(`Order Confirmed: ${pendingSide.toUpperCase()} ${margin} USDT x${leverage}`);
            setIsModalOpen(false);
            setMargin('');
            setPrice('');
            setPendingSide(null);
        } catch (error) {
            console.error("Order failed", error);
            alert("Order failed! Check console.");
        }
    };

    const availableBalance = portfolio?.balance || 0;
    const positionSize = margin ? (parseFloat(margin) * parseInt(leverage)).toFixed(2) : '0.00';

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-full flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Order Entry</h3>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Wallet className="w-3 h-3" />
                    <span>Avail: <span className="text-white font-medium">{availableBalance.toFixed(2)} USDT</span></span>
                </div>
            </div>

            {/* Order Type Tabs */}
            <div className="flex bg-gray-900 rounded p-1 mb-4">
                <button
                    onClick={() => setOrderType('LIMIT')}
                    className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${orderType === 'LIMIT' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Limit
                </button>
                <button
                    onClick={() => setOrderType('MARKET')}
                    className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${orderType === 'MARKET' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Market
                </button>
            </div>

            {/* Leverage */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-400">Leverage</label>
                    <span className="text-xs font-bold text-blue-400">{leverage}x</span>
                </div>
                <div className="flex bg-gray-900 rounded border border-gray-700 p-1">
                    {['1', '5', '10', '20', '50', '100'].map((lev) => (
                        <button
                            key={lev}
                            onClick={() => setLeverage(lev)}
                            className={`flex-1 text-xs py-1 rounded transition-colors ${leverage === lev ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {lev}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Price Input (Limit Only) */}
            {orderType === 'LIMIT' && (
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1">Price (USDT)</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-blue-500 focus:outline-none transition-colors font-mono"
                        placeholder="Entry Price"
                    />
                </div>
            )}

            {/* Margin Input */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-400">Margin (Cost)</label>
                    <span className="text-xs text-gray-500">USDT</span>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        value={margin}
                        onChange={(e) => setMargin(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-blue-500 focus:outline-none transition-colors font-mono"
                        placeholder="Min 10.00"
                    />
                </div>
                {/* Percentage Shortcuts */}
                <div className="flex gap-2 mt-2">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                        <button
                            key={pct}
                            onClick={() => setMargin((availableBalance * pct).toFixed(2))}
                            className="flex-1 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            {pct * 100}%
                        </button>
                    ))}
                </div>
            </div>

            {/* TP/SL Section */}
            <div className="mb-6 space-y-3 border-t border-gray-800 pt-4">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={tpEnabled}
                        onChange={(e) => setTpEnabled(e.target.checked)}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0"
                    />
                    <label className="text-xs text-gray-300">Take Profit</label>
                    {tpEnabled && (
                        <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(e.target.value)}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none ml-2"
                            placeholder="Price"
                        />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={slEnabled}
                        onChange={(e) => setSlEnabled(e.target.checked)}
                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0"
                    />
                    <label className="text-xs text-gray-300">Stop Loss</label>
                    {slEnabled && (
                        <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(e.target.value)}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none ml-4"
                            placeholder="Price"
                        />
                    )}
                </div>
            </div>

            {/* Order Summary */}
            <div className="mt-auto mb-6 space-y-2 text-xs text-gray-400 bg-gray-900/50 p-3 rounded border border-gray-800">
                <div className="flex justify-between">
                    <span>Position Size</span>
                    <span className="text-white font-medium">{positionSize} USDT</span>
                </div>
                <div className="flex justify-between">
                    <span>Est. Fee (0.1%)</span>
                    <span className="text-white">{margin ? (parseFloat(positionSize) * 0.001).toFixed(2) : '0.00'} USDT</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={() => handleOrderClick('buy')}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold transition-colors shadow-lg shadow-green-900/20"
                >
                    Open Long
                </button>
                <button
                    onClick={() => handleOrderClick('sell')}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors shadow-lg shadow-red-900/20"
                >
                    Open Short
                </button>
            </div>

            <ApprovalModal
                isOpen={isModalOpen}
                onConfirm={handleConfirm}
                onCancel={() => { setIsModalOpen(false); setPendingSide(null); }}
                action={pendingSide === 'buy' ? 'OPEN LONG' : 'OPEN SHORT'}
                amount={margin} // Display Margin in modal
            />
        </div>
    );
};
