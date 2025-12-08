import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Order {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    price: number;
    amount: number;
    stop_loss?: number;
    take_profit?: number;
}

interface EditOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onSave: (orderId: string, updates: any) => Promise<void>;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ isOpen, onClose, order, onSave }) => {
    const [price, setPrice] = useState<string>('');
    const [amount, setAmount] = useState<string>(''); // Currently amount is Margin (USDT)
    const [stopLoss, setStopLoss] = useState<string>('');
    const [takeProfit, setTakeProfit] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (order) {
            setPrice(order.price ? order.price.toString() : '');
            setAmount(order.amount ? order.amount.toString() : '');
            setStopLoss(order.stop_loss ? order.stop_loss.toString() : '');
            setTakeProfit(order.take_profit ? order.take_profit.toString() : '');
        }
    }, [order]);

    if (!isOpen || !order) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const updates: any = {};
            if (price) updates.price = parseFloat(price);
            if (amount) updates.amount = parseFloat(amount);

            // Handle SL/TP: Empty string means remove? Or verify vs entry?
            // For now, if empty, send null?
            // Backend handles updates.
            updates.stop_loss = stopLoss ? parseFloat(stopLoss) : null;
            updates.take_profit = takeProfit ? parseFloat(takeProfit) : null;

            await onSave(order.id, updates);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to update order");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Edit Order: {order.symbol}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Limit Price (USDT)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Margin Amount (USDT)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Stop Loss</label>
                            <input
                                type="number"
                                step="0.01"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="None"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Take Profit</label>
                            <input
                                type="number"
                                step="0.01"
                                value={takeProfit}
                                onChange={(e) => setTakeProfit(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="None"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditOrderModal;
