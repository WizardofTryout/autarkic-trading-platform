import { useEffect, useRef, useState } from 'react';

export interface BinanceKline {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
    B: string; // Ignore
}

export const useBinanceWebSocket = (symbol: string, timeframe: string, onUpdate: (candle: any) => void) => {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');

    useEffect(() => {
        // Format symbol for Binance stream (lowercase, no slash)
        // e.g., BTC/USDT -> btcusdt
        const formattedSymbol = symbol.replace('/', '').toLowerCase();

        // Binance stream URL
        // Stream name: <symbol>@kline_<interval>
        const streamName = `${formattedSymbol}@kline_${timeframe}`;
        const url = `wss://stream.binance.com:9443/ws/${streamName}`;

        console.log(`Connecting to Binance WS: ${url}`);
        const ws = new WebSocket(url);
        wsRef.current = ws;
        setStatus('CONNECTING');

        ws.onopen = () => {
            console.log('Binance WS Connected');
            setStatus('OPEN');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.e === 'kline') {
                const k = message.k;
                const candle = {
                    time: new Date(k.t).toISOString().replace('T', ' ').substring(0, 19), // Match backend format YYYY-MM-DD HH:MM:SS roughly, or use Date object
                    // Actually D3Chart expects specific format. Let's return a unified object.
                    // Ideally D3Chart should handle Date objects.
                    // For now let's match the backend format: YYYY-MM-DD HH:MM:SS
                    // But wait, D3Chart parses dates.

                    // Let's pass the raw values and let the component handle it, 
                    // or format it to match the IndicatorData interface.
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v),
                    timestamp: k.t, // Useful for sorting/merging
                    isClosed: k.x
                };
                onUpdate(candle);
            }
        };

        ws.onerror = (error) => {
            console.error('Binance WS Error:', error);
        };

        ws.onclose = () => {
            console.log('Binance WS Closed');
            setStatus('CLOSED');
        };

        return () => {
            ws.close();
        };
    }, [symbol, timeframe, onUpdate]);

    return { status };
};
