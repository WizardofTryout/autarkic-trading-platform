import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Percent } from 'lucide-react';

interface BacktestMetricsProps {
    metrics: {
        // Support both old and new metric names
        initial_capital?: number;
        final_capital?: number;
        net_profit?: number;
        total_return_percent?: number;
        total_return?: number;
        total_trades?: number;
        win_rate?: number;
        max_drawdown_percent?: number;
        max_drawdown?: number;
        sharpe_ratio?: number;
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

    // Safely get values with fallbacks
    const netProfit = metrics.net_profit ?? 0;
    const totalReturn = metrics.total_return_percent ?? metrics.total_return ?? 0;
    const winRate = metrics.win_rate ?? 0;
    const maxDrawdown = metrics.max_drawdown_percent ?? metrics.max_drawdown ?? 0;
    const totalTrades = metrics.total_trades ?? 0;
    const finalCapital = metrics.final_capital ?? (metrics.initial_capital ?? 10000) + netProfit;
    const sharpeRatio = metrics.sharpe_ratio ?? 0;

    const isProfit = netProfit >= 0;
    const profitColor = isProfit ? 'text-green-400' : 'text-red-400';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
                title="Net Profit"
                value={`$${netProfit.toFixed(2)}`}
                icon={isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                color={profitColor}
            />
            <MetricCard
                title="Total Return"
                value={`${totalReturn.toFixed(2)}%`}
                icon={<Percent size={20} />}
                color={profitColor}
            />
            <MetricCard
                title="Win Rate"
                value={`${winRate.toFixed(1)}%`}
                icon={<Activity size={20} />}
                color="text-blue-400"
            />
            <MetricCard
                title="Max Drawdown"
                value={`${maxDrawdown.toFixed(2)}%`}
                icon={<TrendingDown size={20} />}
                color="text-red-400"
            />
            <MetricCard
                title="Total Trades"
                value={totalTrades.toString()}
                icon={<Activity size={20} />}
                color="text-gray-200"
            />
            <MetricCard
                title="Final Capital"
                value={`$${finalCapital.toFixed(2)}`}
                icon={<DollarSign size={20} />}
                color="text-yellow-400"
            />
            <MetricCard
                title="Sharpe Ratio"
                value={sharpeRatio.toFixed(2)}
                icon={<Activity size={20} />}
                color="text-purple-400"
            />
        </div>
    );
};

export default BacktestMetrics;
