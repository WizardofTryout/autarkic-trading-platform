/**
 * KlineChartPro - React Wrapper für KlineCharts Pro
 * 
 * Professioneller Trading-Chart mit:
 * - 40+ Built-in Indikatoren
 * - Zeichenwerkzeuge (Trendlines, Fibonacci, etc.)
 * - Live Binance WebSocket Updates
 * - Responsive Design
 */

import React, { useEffect, useRef } from 'react';
import { KLineChartPro } from '@klinecharts/pro';
import '@klinecharts/pro/dist/klinecharts-pro.css';
import { binanceDatafeed } from '../../services/BinanceDatafeed';
import { useTradingStore } from '../../store/tradingStore';

interface KlineChartProProps {
    symbol?: string;
    timeframe?: string;
    onSymbolChange?: (symbol: string) => void;
    onTimeframeChange?: (timeframe: string) => void;
}

// Verfügbare Perioden/Timeframes
const periods = [
    { multiplier: 1, timespan: 'minute', text: '1m' },
    { multiplier: 5, timespan: 'minute', text: '5m' },
    { multiplier: 15, timespan: 'minute', text: '15m' },
    { multiplier: 30, timespan: 'minute', text: '30m' },
    { multiplier: 1, timespan: 'hour', text: '1h' },
    { multiplier: 4, timespan: 'hour', text: '4h' },
    { multiplier: 1, timespan: 'day', text: '1D' },
    { multiplier: 1, timespan: 'week', text: '1W' },
];

// Timeframe String zu Period Objekt
function timeframeToPeriod(tf: string) {
    const found = periods.find(p => p.text.toLowerCase() === tf.toLowerCase());
    return found || periods[4]; // Default: 1h
}

const KlineChartProComponent: React.FC<KlineChartProProps> = ({
    symbol = 'BTC/USDT',
    timeframe = '1h',
    onSymbolChange,
    onTimeframeChange,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<KLineChartPro | null>(null);
    const { setSymbol, setTimeframe } = useTradingStore();

    // Chart initialisieren - wird bei Symbol/Timeframe-Änderung neu erstellt
    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup vorherige Instanz
        if (containerRef.current.children.length > 0) {
            containerRef.current.innerHTML = '';
        }
        chartRef.current = null;

        // Symbol-Info erstellen
        const symbolInfo = {
            ticker: symbol,
            name: symbol.replace('/', ' / '),
            shortName: symbol.replace('/', ''),
            exchange: 'BINANCE',
            market: 'crypto',
            priceCurrency: 'USDT',
            type: 'crypto',
        };

        console.log('Creating KlineChartPro for:', symbol, timeframe);

        // Chart erstellen
        const chart = new KLineChartPro({
            container: containerRef.current,

            // Symbol und Period
            symbol: symbolInfo,
            period: timeframeToPeriod(timeframe),
            periods: periods,

            // Custom Datafeed für Binance
            datafeed: binanceDatafeed,

            // Lokalisierung
            locale: 'en-US',

            // Theme (Dark Mode passend zum Trading UI)
            styles: {
                grid: {
                    horizontal: {
                        color: 'rgba(75, 85, 99, 0.3)',
                    },
                    vertical: {
                        color: 'rgba(75, 85, 99, 0.3)',
                    },
                },
                candle: {
                    bar: {
                        upColor: '#10B981',
                        downColor: '#EF4444',
                        noChangeColor: '#6B7280',
                        upBorderColor: '#10B981',
                        downBorderColor: '#EF4444',
                        noChangeBorderColor: '#6B7280',
                        upWickColor: '#10B981',
                        downWickColor: '#EF4444',
                        noChangeWickColor: '#6B7280',
                    },
                },
                indicator: {
                    lastValueMark: {
                        show: true,
                    },
                },
                xAxis: {
                    axisLine: {
                        color: 'rgba(75, 85, 99, 0.5)',
                    },
                    tickText: {
                        color: '#9CA3AF',
                    },
                },
                yAxis: {
                    axisLine: {
                        color: 'rgba(75, 85, 99, 0.5)',
                    },
                    tickText: {
                        color: '#9CA3AF',
                    },
                },
                crosshair: {
                    horizontal: {
                        line: {
                            color: '#6366F1',
                        },
                        text: {
                            backgroundColor: '#6366F1',
                        },
                    },
                    vertical: {
                        line: {
                            color: '#6366F1',
                        },
                        text: {
                            backgroundColor: '#6366F1',
                        },
                    },
                },
                separator: {
                    color: 'rgba(75, 85, 99, 0.5)',
                },
            },

            // Zeichenwerkzeuge aktivieren
            drawingBarVisible: true,

            // Callbacks - wenn Nutzer im Chart ändert
            onSymbolChange: (newSymbol: any) => {
                console.log('Chart symbol changed:', newSymbol.ticker);
                setSymbol(newSymbol.ticker);
                onSymbolChange?.(newSymbol.ticker);
            },
            onPeriodChange: (period: any) => {
                console.log('Chart period changed:', period.text);
                setTimeframe(period.text.toLowerCase());
                onTimeframeChange?.(period.text.toLowerCase());
            },
        });

        chartRef.current = chart;

        // Cleanup on unmount
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            chartRef.current = null;
        };
    }, [symbol, timeframe]); // Neu erstellen wenn Symbol oder Timeframe sich ändert

    return (
        <div
            ref={containerRef}
            className="klinechart-wrapper w-full h-full bg-gray-900 overflow-hidden"
        />
    );
};

export default KlineChartProComponent;
