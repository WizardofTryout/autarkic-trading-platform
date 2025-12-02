import { useEffect, useState, useRef } from 'react';

export const useBinanceTicker = (symbol: string = 'BTC/USDT') => {
    const [price, setPrice] = useState<number | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const formattedSymbol = symbol.replace('/', '').toLowerCase();
        const url = `wss://stream.binance.com:9443/ws/${formattedSymbol}@ticker`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.c) {
                setPrice(parseFloat(message.c));
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [symbol]);

    return price;
};
