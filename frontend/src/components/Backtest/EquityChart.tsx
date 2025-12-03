import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, AreaSeries } from 'lightweight-charts';

interface EquityChartProps {
    data: { time: number; value: number }[];
}

const EquityChart: React.FC<EquityChartProps> = ({ data }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // gray-900
                textColor: '#9CA3AF', // gray-400
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            grid: {
                vertLines: { color: '#374151' },
                horzLines: { color: '#374151' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#10B981', // green-500
            topColor: 'rgba(16, 185, 129, 0.4)',
            bottomColor: 'rgba(16, 185, 129, 0.0)',
        });

        if (data && data.length > 0) {
            // Ensure data is sorted by time
            const sortedData = [...data].sort((a, b) => a.time - b.time);
            areaSeries.setData(sortedData);
            chart.timeScale().fitContent();
        }

        chartRef.current = chart;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-gray-300 font-semibold mb-4">Equity Curve</h3>
            <div ref={chartContainerRef} className="w-full h-[300px]" />
        </div>
    );
};

export default EquityChart;
