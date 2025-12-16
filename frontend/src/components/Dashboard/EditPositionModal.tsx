import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Position {
    id: string;
    symbol: string;
    side: string;
    size: number;
    entry_price: number;
    stop_loss: number | null;
    take_profit: number | null;
    is_trailing_stop: boolean;
    trailing_percent: number | null;
}

interface EditPositionModalProps {
    position: Position | null;
    currentPrice: number;
    onClose: () => void;
    onSave: (positionId: string, updates: { stop_loss?: number; take_profit?: number }) => Promise<void>;
}

const EditPositionModal: React.FC<EditPositionModalProps> = ({
    position,
    currentPrice,
    onClose,
    onSave
}) => {
    const [stopLoss, setStopLoss] = useState<string>('');
    const [takeProfit, setTakeProfit] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (position) {
            setStopLoss(position.stop_loss?.toFixed(2) || '');
            setTakeProfit(position.take_profit?.toFixed(2) || '');
        }
    }, [position]);

    if (!position) return null;

    const isLong = position.side === 'LONG' || position.side === 'BUY';

    // Calculate distances from entry price
    const slDistance = stopLoss ? ((Math.abs(position.entry_price - parseFloat(stopLoss)) / position.entry_price) * 100).toFixed(2) : '0';
    const tpDistance = takeProfit ? ((Math.abs(parseFloat(takeProfit) - position.entry_price) / position.entry_price) * 100).toFixed(2) : '0';

    // Calculate potential P&L
    const slPnl = stopLoss ? (isLong 
        ? (parseFloat(stopLoss) - position.entry_price) * position.size
        : (position.entry_price - parseFloat(stopLoss)) * position.size
    ) : 0;
    
    const tpPnl = takeProfit ? (isLong
        ? (parseFloat(takeProfit) - position.entry_price) * position.size
        : (position.entry_price - parseFloat(takeProfit)) * position.size
    ) : 0;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates: { stop_loss?: number; take_profit?: number } = {};
            if (stopLoss) updates.stop_loss = parseFloat(stopLoss);
            if (takeProfit) updates.take_profit = parseFloat(takeProfit);
            
            await onSave(position.id, updates);
            onClose();
        } catch (error) {
            console.error('Failed to update position:', error);
            alert('Failed to update position');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-lg transform transition-all">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Edit Position</h3>
                        <p className="text-sm text-gray-400 mt-1">
                            {position.symbol} {position.side} {position.size.toFixed(4)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Current Info */}
                    <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Entry Price:</span>
                            <span className="text-white font-medium">${position.entry_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Current Price:</span>
                            <span className="text-white font-medium">${currentPrice.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Stop Loss Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Stop Loss
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Enter stop loss price"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                USDT
                            </div>
                        </div>
                        {stopLoss && (
                            <div className="mt-2 flex justify-between text-xs">
                                <span className="text-gray-400">{slDistance}% from entry</span>
                                <span className={`font-medium ${slPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {slPnl >= 0 ? '+' : ''}{slPnl.toFixed(2)} USDT
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Take Profit Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Take Profit
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={takeProfit}
                                onChange={(e) => setTakeProfit(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Enter take profit price"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                USDT
                            </div>
                        </div>
                        {takeProfit && (
                            <div className="mt-2 flex justify-between text-xs">
                                <span className="text-gray-400">{tpDistance}% from entry</span>
                                <span className={`font-medium ${tpPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {tpPnl >= 0 ? '+' : ''}{tpPnl.toFixed(2)} USDT
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 bg-gray-900/50 rounded-b-xl border-t border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || (!stopLoss && !takeProfit)}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditPositionModal;
