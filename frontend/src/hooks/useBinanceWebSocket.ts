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

export interface CandleData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
    isClosed: boolean;
}

export const useBinanceWebSocket = (
    symbols: string | string[],
    timeframe: string,
    onUpdate?: (candle: any) => void,
    options: { skipStateUpdate?: boolean } = {}
) => {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');
    const [currentData, setCurrentData] = useState<Record<string, CandleData>>({});

    useEffect(() => {
        const symbolList = Array.isArray(symbols) ? symbols : [symbols];
        if (symbolList.length === 0) return;

        // Format symbols for Binance stream (lowercase, no slash)
        // e.g., BTC/USDT -> btcusdt
        const streams = symbolList.map(s => `${s.replace('/', '').toLowerCase()}@kline_${timeframe}`).join('/');

        // Binance stream URL
        // Combined streams: wss://stream.binance.com:9443/stream?streams=<stream1>/<stream2>
        const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

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
            // Combined stream format: { stream: "...", data: { ... } }
            const data = message.data || message; // Handle both combined and single stream if logic changes

            if (data.e === 'kline') {
                const k = data.k;
                const symbol = k.s; // Symbol from kline data (e.g. BTCUSDT)

                // Map back to our format if needed, or just use as key.
                // Our symbols are like BTC/USDT. Binance sends BTCUSDT.
                // We might need a map if we want exact matches, but for now let's try to match loosely or just use the binance symbol.
                // Ideally we map BTCUSDT -> BTC/USDT.
                // Let's iterate our input symbols to find the match.
                const originalSymbol = symbolList.find(s => s.replace('/', '').toUpperCase() === symbol);
                const key = originalSymbol || symbol;

                const candle: CandleData = {
                    time: new Date(k.t).toISOString().replace('T', ' ').substring(0, 19),
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v),
                    timestamp: k.t,
                    isClosed: k.x
                };

                if (!options.skipStateUpdate) {
                    setCurrentData(prev => ({
                        ...prev,
                        [key]: candle
                    }));
                }

                if (onUpdate) {
                    onUpdate(candle);
                }
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
    }, [JSON.stringify(symbols), timeframe, onUpdate, options.skipStateUpdate]); // Use stringified symbols to avoid deep dependency issues

    return { status, currentData };
};
