import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, AreaSeries } from 'lightweight-charts';

interface EquityChartProps {
    data: { time: number | string; value: number }[];
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
            // Convert time to Unix timestamp if it's a string
            const processedData = data.map(item => {
                let time: number;
                if (typeof item.time === 'string') {
                    // Parse ISO string to Unix timestamp (seconds)
                    time = Math.floor(new Date(item.time).getTime() / 1000);
                } else {
                    time = item.time;
                }
                return { time, value: item.value };
            });
            
            // Sort by time and remove duplicates (keep last value for each timestamp)
            const sortedData = processedData.sort((a, b) => a.time - b.time);
            
            // Deduplicate: lightweight-charts requires unique timestamps
            const uniqueData: { time: number; value: number }[] = [];
            for (const point of sortedData) {
                if (uniqueData.length === 0 || uniqueData[uniqueData.length - 1].time < point.time) {
                    uniqueData.push(point);
                } else if (uniqueData[uniqueData.length - 1].time === point.time) {
                    // Same timestamp - update value (keep the latest)
                    uniqueData[uniqueData.length - 1].value = point.value;
                }
            }
            
            areaSeries.setData(uniqueData);
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
