import React from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { ActivePosition } from '../../store/fleetStore';
import { TrendingUp, TrendingDown, Target, Shield, Activity, XCircle } from 'lucide-react';

interface ActivePositionCardProps {
    position: ActivePosition;
}

export const ActivePositionCard: React.FC<ActivePositionCardProps> = ({ position }) => {
    const { closePosition } = useFleetStore();
    const isProfitable = position.unrealized_pnl >= 0;
    const pnlPercent = ((position.current_price - position.entry_price) / position.entry_price) * 100 * (position.side === 'LONG' ? 1 : -1);

    const handleClose = async () => {
        if (window.confirm("Are you sure you want to close this position?")) {
            await closePosition(position.id);
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 backdrop-blur-sm animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${position.side === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {position.side === 'LONG' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {position.symbol}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${position.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {position.side}
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400">Position ID: {position.id.slice(0, 8)}</p>
                    </div>
                </div>

                <div className={`text-right ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                    <div className="text-xl font-mono font-bold">
                        {isProfitable ? '+' : ''}{position.unrealized_pnl.toFixed(2)} USDT
                    </div>
                    <div className="text-xs font-mono">
                        {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-xs mb-1">Entry Price</div>
                    <div className="font-mono text-white">${position.entry_price.toLocaleString()}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-xs mb-1">Current Price</div>
                    <div className="font-mono text-white">${position.current_price.toLocaleString()}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                            <Shield size={12} /> Stop Loss
                        </div>
                        <div className="font-mono text-red-300">
                            ${position.stop_loss ? position.stop_loss.toLocaleString() : '-'}
                        </div>
                    </div>
                    {position.is_trailing_stop && (
                        <div className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                            Trailing {position.trailing_percent}%
                        </div>
                    )}
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                        <Target size={12} /> Take Profit
                    </div>
                    <div className="font-mono text-green-300">
                        ${position.take_profit ? position.take_profit.toLocaleString() : '-'}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Activity size={14} /> Size: {position.size} {position.symbol.split('/')[0]}
                </div>
                <button
                    onClick={handleClose}
                    className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded transition-colors text-red-400 hover:text-red-300"
                >
                    <XCircle size={14} /> Close Position
                </button>
            </div>
        </div>
    );
};
