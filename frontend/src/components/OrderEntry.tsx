import React, { useState } from 'react';
import { ApprovalModal } from './ApprovalModal';

export const OrderEntry: React.FC = () => {
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleOrderClick = () => {
        if (!amount) return;
        setIsModalOpen(true);
    };

    const handleConfirm = () => {
        console.log(`Order Confirmed: ${side.toUpperCase()} ${amount} USDT`);
        setIsModalOpen(false);
        setAmount('');
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Order Entry</h3>
            <div className="flex gap-2 mb-4">
                <button
                    className={`flex-1 py-2 rounded ${side === 'buy' ? 'bg-green-600' : 'bg-gray-700'}`}
                    onClick={() => setSide('buy')}
                >
                    Buy
                </button>
                <button
                    className={`flex-1 py-2 rounded ${side === 'sell' ? 'bg-red-600' : 'bg-gray-700'}`}
                    onClick={() => setSide('sell')}
                >
                    Sell
                </button>
            </div>
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Amount (USDT)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                    placeholder="100"
                />
            </div>
            <button
                onClick={handleOrderClick}
                className={`w-full py-3 rounded font-bold ${side === 'buy' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
            >
                {side === 'buy' ? 'Buy BTC' : 'Sell BTC'}
            </button>

            <ApprovalModal
                isOpen={isModalOpen}
                onConfirm={handleConfirm}
                onCancel={() => setIsModalOpen(false)}
                action={side.toUpperCase()}
                amount={amount}
            />
        </div>
    );
};

