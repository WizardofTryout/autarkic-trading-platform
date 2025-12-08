import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface TradeResult {
    symbol: string;
    side: string;
    entryPrice: number;
    closePrice: number;
    size: number;
    pnl: number;
    pnlPercent: number;
}

interface TradeResultModalProps {
    isOpen: boolean;
    result: TradeResult | null;
    onClose: () => void;
}

const TradeResultModal: React.FC<TradeResultModalProps> = ({
    isOpen,
    result,
    onClose,
}) => {
    if (!isOpen || !result) return null;

    const isProfitable = result.pnl >= 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <CheckCircle className={`w-5 h-5 ${isProfitable ? 'text-green-500' : 'text-red-500'}`} />
                        Position Closed
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Symbol</span>
                        <span className="text-white font-medium">{result.symbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Side</span>
                        <span className={result.side === 'LONG' || result.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                            {result.side === 'LONG' || result.side === 'BUY' ? 'LONG' : 'SHORT'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Entry Price</span>
                        <span className="text-white">{result.entryPrice.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Close Price</span>
                        <span className="text-white">{result.closePrice.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Size</span>
                        <span className="text-white">{result.size.toFixed(4)}</span>
                    </div>
                    <hr className="border-gray-700" />
                    <div className="flex justify-between text-base font-bold">
                        <span className="text-gray-300">Realized PnL</span>
                        <span className={isProfitable ? 'text-green-400' : 'text-red-400'}>
                            {isProfitable ? '+' : ''}{result.pnl.toFixed(2)} USDT ({result.pnlPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm transition-colors"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default TradeResultModal;
