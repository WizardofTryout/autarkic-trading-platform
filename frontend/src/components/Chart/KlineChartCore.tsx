/**
 * KlineChartCore - React Wrapper für KlineCharts (Core)
 * 
 * Verwendet die Core-Library direkt für vollen API-Zugang:
 * - createOverlay() für Position Lines (Entry/TP/SL)
 * - createIndicator() für Built-in & Custom Indikatoren
 * - registerIndicator() für eigene Strategien
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { init, dispose, type Chart, registerLocale } from 'klinecharts';
import { useTradingStore } from '../../store/tradingStore';
import { getMarketData } from '../../services/api';
import ChartSettingsComponent from './ChartSettings';
import KlineToolbar from './KlineToolbar';
import IndicatorModal from './IndicatorModal';

// English locale for chart labels
registerLocale('en-US', {
    time: 'Time',
    open: 'Open',
    high: 'High',
    low: 'Low',
    close: 'Close',
    volume: 'Volume',
    turnover: 'Turnover',
});

interface KlineChartCoreProps {
    symbol?: string;
    timeframe?: string;
}

// Timeframe mapping for backend and Binance
const TIMEFRAME_MAP: Record<string, { multiplier: number; unit: string; binance: string }> = {
    '1s': { multiplier: 1, unit: 's', binance: '1s' },
    '10s': { multiplier: 10, unit: 's', binance: '1s' }, // Aggregate 10x
    '30s': { multiplier: 30, unit: 's', binance: '1s' }, // Aggregate 30x
    '1m': { multiplier: 1, unit: 'm', binance: '1m' },
    '5m': { multiplier: 5, unit: 'm', binance: '5m' },
    '15m': { multiplier: 15, unit: 'm', binance: '15m' },
    '30m': { multiplier: 30, unit: 'm', binance: '30m' },
    '1h': { multiplier: 1, unit: 'h', binance: '1h' },
    '4h': { multiplier: 4, unit: 'h', binance: '4h' },
    '1d': { multiplier: 1, unit: 'd', binance: '1d' },
};

// Dark theme styles matching the trading UI
const darkThemeStyles = {
    grid: {
        horizontal: { color: 'rgba(255, 255, 255, 0.06)' },
        vertical: { color: 'rgba(255, 255, 255, 0.06)' },
    },
    candle: {
        priceMark: {
            last: {
                upColor: '#22c55e',
                downColor: '#ef4444',
                noChangeColor: '#888888',
                line: { show: true, color: '#3B82F6' },
                text: { show: true, color: '#ffffff' },
            },
            high: { color: '#22c55e', textOffset: 5 },
            low: { color: '#ef4444', textOffset: 5 },
        },
        bar: {
            upColor: '#22c55e',
            downColor: '#ef4444',
            noChangeColor: '#888888',
            upBorderColor: '#22c55e',
            downBorderColor: '#ef4444',
            noChangeBorderColor: '#888888',
            upWickColor: '#22c55e',
            downWickColor: '#ef4444',
            noChangeWickColor: '#888888',
        },
        tooltip: {
            showRule: 'always',
            showType: 'standard',
            text: { color: '#D1D4DC' },
        },
    },
    indicator: {
        ohlc: { upColor: '#22c55e', downColor: '#ef4444', noChangeColor: '#888888' },
        bars: [
            { upColor: 'rgba(34, 197, 94, 0.6)', downColor: 'rgba(239, 68, 68, 0.6)', noChangeColor: '#888888' }
        ],
        lines: [
            { color: '#FF6D00' },
            { color: '#2196F3' },
            { color: '#E040FB' },
            { color: '#00E676' },
            { color: '#FFEA00' },
        ],
    },
    xAxis: {
        axisLine: { color: 'rgba(255, 255, 255, 0.1)' },
        tickLine: { color: 'rgba(255, 255, 255, 0.1)' },
        tickText: { color: '#787B86' },
    },
    yAxis: {
        axisLine: { color: 'rgba(255, 255, 255, 0.1)' },
        tickLine: { color: 'rgba(255, 255, 255, 0.1)' },
        tickText: { color: '#787B86' },
    },
    crosshair: {
        horizontal: {
            line: { color: '#787B86', style: 'dashed' },
            text: { color: '#ffffff', backgroundColor: '#3B82F6' },
        },
        vertical: {
            line: { color: '#787B86', style: 'dashed' },
            text: { color: '#ffffff', backgroundColor: '#3B82F6' },
        },
    },
    overlay: {
        point: { color: '#3B82F6', borderColor: '#3B82F6' },
        line: { color: '#3B82F6' },
        rect: { color: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
        text: { color: '#D1D4DC' },
    },
    separator: { color: 'rgba(255, 255, 255, 0.1)' },
};

const KlineChartCoreComponent: React.FC<KlineChartCoreProps> = ({ symbol, timeframe }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const {
        symbol: storeSymbol,
        timeframe: storeTimeframe,
        portfolio,
        chartBackgroundColor,
        chartTextColor,
    } = useTradingStore();

    const currentSymbol = symbol || storeSymbol;
    const currentTimeframe = timeframe || storeTimeframe;

    const [isIndicatorModalOpen, setIsIndicatorModalOpen] = React.useState(false);

    // Format symbol for Binance WebSocket
    const formatSymbolForBinance = (sym: string): string => {
        return sym.replace('/', '').toLowerCase();
    };

    // Load historical data
    const loadHistoricalData = useCallback(async () => {
        if (!chartRef.current || !currentSymbol) return;

        try {
            const data = await getMarketData(currentSymbol, currentTimeframe, 500);
            if (Array.isArray(data) && data.length > 0) {
                const klineData = data.map((candle: any) => ({
                    timestamp: candle.timestamp || new Date(candle.time).getTime(),
                    open: parseFloat(candle.open),
                    high: parseFloat(candle.high),
                    low: parseFloat(candle.low),
                    close: parseFloat(candle.close),
                    volume: parseFloat(candle.volume || 0),
                    turnover: parseFloat(candle.volume || 0) * parseFloat(candle.close),
                }));
                chartRef.current.applyNewData(klineData);
            }
        } catch (error) {
            console.error('Failed to load historical data:', error);
        }
    }, [currentSymbol, currentTimeframe]);

    // Subscribe to WebSocket updates
    const subscribeToUpdates = useCallback(() => {
        if (!chartRef.current || !currentSymbol) return;

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const binanceSymbol = formatSymbolForBinance(currentSymbol);
        const tf = TIMEFRAME_MAP[currentTimeframe]?.binance || '1m';
        const stream = `${binanceSymbol}@kline_${tf}`;
        const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;

        console.log(`KlineChartCore subscribing to: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.e === 'kline' && chartRef.current) {
                    const k = message.k;
                    chartRef.current.updateData({
                        timestamp: k.t,
                        open: parseFloat(k.o),
                        high: parseFloat(k.h),
                        low: parseFloat(k.l),
                        close: parseFloat(k.c),
                        volume: parseFloat(k.v),
                        turnover: parseFloat(k.v) * parseFloat(k.c),
                    });
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('Binance WebSocket error:', error);
        };

        wsRef.current = ws;
    }, [currentSymbol, currentTimeframe]);

    // Update position overlays
    const updatePositionOverlays = useCallback(() => {
        if (!chartRef.current || !portfolio?.positions) return;

        // Remove existing position overlays
        chartRef.current.removeOverlay({ groupId: 'positions' });

        // Find position for current symbol
        const position = portfolio.positions.find(
            (p: any) => p.symbol === currentSymbol
        );

        if (position) {
            // Entry Line (blue)
            chartRef.current.createOverlay({
                name: 'priceLine',
                groupId: 'positions',
                lock: true,
                points: [{ value: position.entry_price }],
                styles: {
                    line: { color: '#3B82F6', style: 'solid', size: 1 },
                    text: { color: '#ffffff', backgroundColor: '#3B82F6' },
                },
                extendData: 'Entry',
            });

            // Take Profit Line (green)
            if (position.take_profit) {
                chartRef.current.createOverlay({
                    name: 'priceLine',
                    groupId: 'positions',
                    lock: true,
                    points: [{ value: position.take_profit }],
                    styles: {
                        line: { color: '#22c55e', style: 'dashed', size: 1 },
                        text: { color: '#ffffff', backgroundColor: '#22c55e' },
                    },
                    extendData: 'TP',
                });
            }

            // Stop Loss Line (red)
            if (position.stop_loss) {
                chartRef.current.createOverlay({
                    name: 'priceLine',
                    groupId: 'positions',
                    lock: true,
                    points: [{ value: position.stop_loss }],
                    styles: {
                        line: { color: '#ef4444', style: 'dashed', size: 1 },
                        text: { color: '#ffffff', backgroundColor: '#ef4444' },
                    },
                    extendData: 'SL',
                });
            }
        }
    }, [portfolio, currentSymbol]);

    // Initialize chart
    useEffect(() => {
        if (!containerRef.current) return;

        // Dispose existing chart
        if (chartRef.current) {
            dispose(chartRef.current);
        }

        // Create new chart
        chartRef.current = init(containerRef.current, {
            locale: 'en-US',
            styles: darkThemeStyles,
        });

        if (chartRef.current) {
            // Add default indicators
            chartRef.current.createIndicator('VOL', false, { id: 'volume_pane', height: 80 });

            // Load data and subscribe
            loadHistoricalData();
            subscribeToUpdates();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (chartRef.current) {
                dispose(chartRef.current);
                chartRef.current = null;
            }
        };
    }, [currentSymbol, currentTimeframe]);

    // Update position overlays when portfolio changes
    useEffect(() => {
        updatePositionOverlays();
    }, [updatePositionOverlays]);

    // Update background color
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.backgroundColor = chartBackgroundColor;
        }
    }, [chartBackgroundColor]);

    // Update text color
    useEffect(() => {
        if (chartRef.current && chartTextColor) {
            chartRef.current.setStyles({
                xAxis: { tickText: { color: chartTextColor } },
                yAxis: { tickText: { color: chartTextColor } },
            });
        }
    }, [chartTextColor]);

    // Public API for adding indicators
    const addIndicator = useCallback((name: string, isStack: boolean = false, paneOptions?: any) => {
        if (chartRef.current) {
            if (isStack) {
                // Main indicator: Add to main pane (default)
                return chartRef.current.createIndicator(name, true, { id: 'candle_pane' });
            } else {
                // Sub indicator: Create new pane with name as ID for easy removal
                return chartRef.current.createIndicator(name, false, { id: name, ...paneOptions });
            }
        }
        return null;
    }, []);

    const removeIndicator = useCallback((name: string, isStack: boolean = false) => {
        if (chartRef.current) {
            if (isStack) {
                // Main indicator: Remove from main pane
                chartRef.current.removeIndicator('candle_pane', name);
            } else {
                // Sub indicator: Remove the pane by ID
                chartRef.current.removeIndicator(name);
            }
        }
    }, []);

    // Expose chart API via window for debugging (optional)
    useEffect(() => {
        (window as any).__klineChart = {
            chart: chartRef.current,
            addIndicator,
            removeIndicator,
        };
    }, [addIndicator, removeIndicator]);




    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <KlineToolbar
                onAddIndicator={(name: string, isStack: boolean) => addIndicator(name, isStack)}
                onRemoveIndicator={(name: string, isMain: boolean) => removeIndicator(name, isMain)}
                onOpenStrategiesModal={() => setIsIndicatorModalOpen(true)}
            />
            <div
                ref={containerRef}
                className="klinechart-core-container"
                style={{
                    flex: 1,
                    width: '100%',
                    backgroundColor: chartBackgroundColor,
                }}
            />
            <ChartSettingsComponent />
            <IndicatorModal
                isOpen={isIndicatorModalOpen}
                onClose={() => setIsIndicatorModalOpen(false)}
                onAddIndicator={(name, isStack) => addIndicator(name, isStack)}
            />
        </div>
    );
};

export default KlineChartCoreComponent;
