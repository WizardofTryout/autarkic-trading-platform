import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { useTradingStore } from '../../store/tradingStore';
// import { getMarketData } from '../../services/api'; // Ensure this exists or use fetch directly
// import { useBinanceWebSocket } from '../../hooks/useBinanceWebSocket'; // Ensure this hook exists

const TradingChart: React.FC = () => {
    const { symbol, timeframe } = useTradingStore();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [data, setData] = useState<any[]>([]);

    // 1. Fetch Historical Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Assuming getMarketData returns { time: string, open, high, low, close }[]
                // We might need to convert time to unix timestamp for lightweight-charts
                const rawData = await fetch(`http://localhost:8000/api/v1/market/ohlcv?symbol=${symbol}&timeframe=${timeframe}&limit=1000`)
                    .then(res => res.json());

                const formattedData = rawData.map((d: any) => ({
                    time: new Date(d.time).getTime() / 1000 as Time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                })).sort((a: any, b: any) => a.time - b.time);

                setData(formattedData);
                if (seriesRef.current) {
                    seriesRef.current.setData(formattedData);
                }
            } catch (error) {
                console.error("Failed to fetch chart data", error);
            }
        };
        fetchData();
    }, [symbol, timeframe]);

    // 2. Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // gray-900
                textColor: '#D1D5DB', // gray-300
            },
            grid: {
                vertLines: { color: '#374151' }, // gray-700
                horzLines: { color: '#374151' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#10B981', // green-500
            downColor: '#EF4444', // red-500
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
        });

        seriesRef.current = series;
        chartRef.current = chart;

        if (data.length > 0) {
            series.setData(data);
        }

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []); // Run once on mount, data updates handled separately

    // 3. WebSocket Updates (Optional for now, implementing basic polling or hook integration later)
    // For now, we rely on fetching historical data on symbol change.
    // TODO: Integrate useBinanceWebSocket for real-time updates on the last candle.

    return (
        <div className="flex flex-col h-full">
            <div className="p-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <h2 className="font-bold text-lg">{symbol} <span className="text-sm font-normal text-gray-400">({timeframe})</span></h2>
                {/* Placeholder for toolbar (drawing tools, etc.) */}
                <div className="flex gap-2">
                    <button className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">1h</button>
                    <button className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">4h</button>
                    <button className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">1d</button>
                </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full min-h-0" />
        </div>
    );
};

export default TradingChart;
