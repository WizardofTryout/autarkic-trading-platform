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
import { registerLocale } from 'klinecharts';
import '@klinecharts/pro/dist/klinecharts-pro.css';
import { binanceDatafeed } from '../../services/BinanceDatafeed';
import { useTradingStore } from '../../store/tradingStore';
import ChartSettingsComponent from './ChartSettings';

// English translations for KlineCharts Pro UI
// Source: https://github.com/klinecharts/pro/blob/main/src/i18n/en-US.json
const enUSLocale = {
    indicator: 'Indicator',
    main_indicator: 'Main Indicator',
    sub_indicator: 'Sub Indicator',
    setting: 'Setting',
    timezone: 'Timezone',
    screenshot: 'Screenshot',
    full_screen: 'Full Screen',
    exit_full_screen: 'Exit',
    save: 'Save',
    confirm: 'Confirm',
    cancel: 'Cancel',
    symbol_search: 'Symbol Search',
    symbol_code: 'Symbol Code',
    params_1: 'Parameter 1',
    params_2: 'Parameter 2',
    params_3: 'Parameter 3',
    params_4: 'Parameter 4',
    params_5: 'Parameter 5',
    period: 'Period',
    standard_deviation: 'Standard Deviation',
    candle_type: 'Candle Type',
    candle_solid: 'Candle Solid',
    candle_stroke: 'Candle Stroke',
    candle_up_stroke: 'Candle Up Stroke',
    candle_down_stroke: 'Candle Down Stroke',
    ohlc: 'OHLC',
    area: 'Area',
    last_price_show: 'Show Last Price',
    high_price_show: 'Show Highest Price',
    low_price_show: 'Show Lowest Price',
    indicator_last_value_show: "Show Indicator's Last Value",
    price_axis_type: 'Price Axis Type',
    normal: 'Normal',
    percentage: 'Percentage',
    log: 'Log',
    reverse_coordinate: 'Reverse Coordinate',
    grid_show: 'Show Grids',
    restore_default: 'Restore Defaults',
    // Drawing tools
    horizontal_straight_line: 'Horizontal Line',
    horizontal_ray_line: 'Horizontal Ray',
    vertical_straight_line: 'Vertical Line',
    straight_line: 'Trend Line',
    ray_line: 'Ray',
    segment: 'Segment',
    arrow: 'Arrow',
    price_line: 'Price Line',
    parallel_straight_line: 'Parallel Line',
    fibonacci_line: 'Fibonacci Line',
    fibonacci_segment: 'Fibonacci Segment',
    fibonacci_circle: 'Fibonacci Circle',
    fibonacci_extension: 'Fibonacci Extension',
    rect: 'Rectangle',
    circle: 'Circle',
    triangle: 'Triangle',
    three_waves: 'Three Waves',
    five_waves: 'Five Waves',
    eight_waves: 'Eight Waves',
    // Indicators
    ma: 'MA (Moving Average)',
    ema: 'EMA (Exponential Moving Average)',
    sma: 'SMA',
    boll: 'BOLL (Bollinger Bands)',
    sar: 'SAR (Stop and Reverse)',
    vol: 'VOL (Volume)',
    macd: 'MACD',
    kdj: 'KDJ',
    rsi: 'RSI (Relative Strength Index)',
    cci: 'CCI (Commodity Channel Index)',
    dmi: 'DMI (Directional Movement Index)',
    obv: 'OBV (On Balance Volume)',
    wr: 'WR (Williams %R)',
    roc: 'ROC (Rate of Change)',
    ao: 'AO (Awesome Oscillator)',
    // Time units (for core chart)
    time: 'Time',
    open: 'Open',
    high: 'High',
    low: 'Low',
    close: 'Close',
    volume: 'Volume',
    turnover: 'Turnover',
    second: 'Second',
    minute: 'Minute',
    hour: 'Hour',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
};

// Register locale with core klinecharts
registerLocale('en-US', enUSLocale);

interface KlineChartProProps {
    symbol?: string;
    timeframe?: string;
    onSymbolChange?: (symbol: string) => void;
    onTimeframeChange?: (timeframe: string) => void;
}

// Verfügbare Perioden/Timeframes (inkl. Sekunden-Intervalle)
const periods = [
    // Sekunden (Binance unterstützt nur 1s für WebSocket)
    { multiplier: 1, timespan: 'second', text: '1s' },
    // Minuten
    { multiplier: 1, timespan: 'minute', text: '1m' },
    { multiplier: 5, timespan: 'minute', text: '5m' },
    { multiplier: 15, timespan: 'minute', text: '15m' },
    { multiplier: 30, timespan: 'minute', text: '30m' },
    // Stunden
    { multiplier: 1, timespan: 'hour', text: '1h' },
    { multiplier: 4, timespan: 'hour', text: '4h' },
    // Tage/Wochen
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
    const { setSymbol, setTimeframe, chartBackgroundColor, chartTextColor } = useTradingStore();

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
                        color: chartTextColor,
                    },
                },
                yAxis: {
                    axisLine: {
                        color: 'rgba(75, 85, 99, 0.5)',
                    },
                    tickText: {
                        color: chartTextColor,
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
    }, [symbol, timeframe, chartTextColor]); // Neu erstellen wenn Symbol, Timeframe oder Textfarbe sich ändert

    // Update background color when it changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.backgroundColor = chartBackgroundColor;
            // Set CSS custom properties for toolbar styling
            containerRef.current.style.setProperty('--chart-bg-color', chartBackgroundColor);
        }
    }, [chartBackgroundColor]);

    // Update text color CSS variable when it changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.setProperty('--chart-text-color', chartTextColor);
        }
    }, [chartTextColor]);

    return (
        <div
            className="relative w-full h-full"
            style={{
                '--chart-bg-color': chartBackgroundColor,
                '--chart-text-color': chartTextColor,
            } as React.CSSProperties}
        >
            {/* Chart Container */}
            <div
                ref={containerRef}
                className="klinechart-wrapper w-full h-full overflow-hidden"
                style={{
                    backgroundColor: chartBackgroundColor,
                    '--chart-bg-color': chartBackgroundColor,
                    '--chart-text-color': chartTextColor,
                } as React.CSSProperties}
            />

            {/* Settings Icon - positioned in top right */}
            <div className="absolute top-2 right-2 z-10">
                <ChartSettingsComponent />
            </div>
        </div>
    );
};

export default KlineChartProComponent;
