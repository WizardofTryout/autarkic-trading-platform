import React from 'react';

interface Trade {
    entry_time: string;
    exit_time: string;
    type: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price: number;
    pnl: number;
    pnl_percent: number;
}

interface TradeListProps {
    trades: Trade[];
}

const TradeList: React.FC<TradeListProps> = ({ trades }) => {
    if (!trades || trades.length === 0) {
        return <div className="text-gray-400 text-center py-4">No trades executed.</div>;
    }

    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-900 sticky top-0">
                    <tr>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Entry Time</th>
                        <th className="px-6 py-3">Entry Price</th>
                        <th className="px-6 py-3">Exit Time</th>
                        <th className="px-6 py-3">Exit Price</th>
                        <th className="px-6 py-3">PnL</th>
                        <th className="px-6 py-3">PnL %</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade, index) => (
                        <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                            <td className={`px-6 py-4 font-bold ${trade.type === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.type}
                            </td>
                            <td className="px-6 py-4">{new Date(trade.entry_time).toLocaleString()}</td>
                            <td className="px-6 py-4">${trade.entry_price.toFixed(2)}</td>
                            <td className="px-6 py-4">{new Date(trade.exit_time).toLocaleString()}</td>
                            <td className="px-6 py-4">${trade.exit_price.toFixed(2)}</td>
                            <td className={`px-6 py-4 font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${trade.pnl.toFixed(2)}
                            </td>
                            <td className={`px-6 py-4 font-bold ${trade.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.pnl_percent.toFixed(2)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TradeList;
