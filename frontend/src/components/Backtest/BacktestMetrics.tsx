import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Percent } from 'lucide-react';

interface BacktestMetricsProps {
    metrics: {
        initial_capital: number;
        final_capital: number;
        net_profit: number;
        total_return_percent: number;
        total_trades: number;
        win_rate: number;
        max_drawdown_percent: number;
    };
}

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
        <div>
            <p className="text-gray-400 text-sm">{title}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-gray-700 ${color.replace('text-', 'text-opacity-80 ')}`}>
            {icon}
        </div>
    </div>
);

const BacktestMetrics: React.FC<BacktestMetricsProps> = ({ metrics }) => {
    if (!metrics) return null;

    const isProfit = metrics.net_profit >= 0;
    const profitColor = isProfit ? 'text-green-400' : 'text-red-400';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
                title="Net Profit"
                value={`$${metrics.net_profit.toFixed(2)}`}
                icon={isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                color={profitColor}
            />
            <MetricCard
                title="Total Return"
                value={`${metrics.total_return_percent.toFixed(2)}%`}
                icon={<Percent size={20} />}
                color={profitColor}
            />
            <MetricCard
                title="Win Rate"
                value={`${metrics.win_rate.toFixed(1)}%`}
                icon={<Activity size={20} />}
                color="text-blue-400"
            />
            <MetricCard
                title="Max Drawdown"
                value={`${metrics.max_drawdown_percent.toFixed(2)}%`}
                icon={<TrendingDown size={20} />}
                color="text-red-400"
            />
            <MetricCard
                title="Total Trades"
                value={metrics.total_trades.toString()}
                icon={<Activity size={20} />}
                color="text-gray-200"
            />
            <MetricCard
                title="Final Capital"
                value={`$${metrics.final_capital.toFixed(2)}`}
                icon={<DollarSign size={20} />}
                color="text-yellow-400"
            />
        </div>
    );
};

export default BacktestMetrics;
