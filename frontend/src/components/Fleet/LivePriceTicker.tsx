/**
 * LivePriceTicker - Real-time price display with WebSocket updates
 * 
 * Shows:
 * - Current price with live updates
 * - Price change indicator (up/down arrow)
 * - Pulse animation on updates
 */

import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import './LivePriceTicker.css';

interface LivePriceTickerProps {
    symbol: string;
}

interface TickerData {
    price: number;
    priceChange: number;
    priceChangePercent: number;
    high24h: number;
    low24h: number;
    volume24h: number;
}

const LivePriceTicker: React.FC<LivePriceTickerProps> = ({ symbol }) => {
    const [tickerData, setTickerData] = useState<TickerData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [isPulsing, setIsPulsing] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const previousPriceRef = useRef<number | null>(null);

    // Format symbol for Binance (BTC/USDT -> btcusdt)
    const formatSymbolForBinance = (sym: string): string => {
        return sym.replace('/', '').toLowerCase();
    };

    useEffect(() => {
        const binanceSymbol = formatSymbolForBinance(symbol);

        // Use 24hr ticker stream for comprehensive data
        const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol}@ticker`;

        console.log(`[LivePriceTicker] Connecting to: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[LivePriceTicker] WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.e === '24hrTicker') {
                    const newPrice = parseFloat(data.c);

                    // Trigger pulse animation on price change
                    if (previousPriceRef.current !== null && previousPriceRef.current !== newPrice) {
                        setIsPulsing(true);
                        setTimeout(() => setIsPulsing(false), 300);
                    }
                    previousPriceRef.current = newPrice;

                    setTickerData({
                        price: newPrice,
                        priceChange: parseFloat(data.p),
                        priceChangePercent: parseFloat(data.P),
                        high24h: parseFloat(data.h),
                        low24h: parseFloat(data.l),
                        volume24h: parseFloat(data.v),
                    });
                    setLastUpdate(new Date());
                }
            } catch (error) {
                console.error('[LivePriceTicker] Parse error:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('[LivePriceTicker] WebSocket error:', error);
            setIsConnected(false);
        };

        ws.onclose = () => {
            console.log('[LivePriceTicker] WebSocket closed');
            setIsConnected(false);
        };

        wsRef.current = ws;

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [symbol]);

    const formatPrice = (price: number): string => {
        if (price >= 1000) {
            return price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        return price.toFixed(price < 1 ? 6 : 4);
    };

    const formatVolume = (volume: number): string => {
        if (volume >= 1_000_000_000) {
            return (volume / 1_000_000_000).toFixed(2) + 'B';
        }
        if (volume >= 1_000_000) {
            return (volume / 1_000_000).toFixed(2) + 'M';
        }
        if (volume >= 1_000) {
            return (volume / 1_000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    };

    if (!tickerData) {
        return (
            <div className="live-price-ticker loading">
                <Activity size={16} className="spinner" />
                <span>Connecting to {symbol}...</span>
            </div>
        );
    }

    const isPositive = tickerData.priceChange >= 0;

    return (
        <div className={`live-price-ticker ${isPulsing ? 'pulse' : ''}`}>
            <div className="ticker-main">
                <div className={`ticker-price ${isPositive ? 'up' : 'down'}`}>
                    <span className="price-value">${formatPrice(tickerData.price)}</span>
                    {isPositive ? (
                        <TrendingUp size={18} className="trend-icon" />
                    ) : (
                        <TrendingDown size={18} className="trend-icon" />
                    )}
                </div>
                <div className={`ticker-change ${isPositive ? 'up' : 'down'}`}>
                    <span>{isPositive ? '+' : ''}{tickerData.priceChange.toFixed(2)}</span>
                    <span className="percent">({isPositive ? '+' : ''}{tickerData.priceChangePercent.toFixed(2)}%)</span>
                </div>
            </div>
            <div className="ticker-details">
                <div className="ticker-stat">
                    <span className="label">24h High</span>
                    <span className="value high">${formatPrice(tickerData.high24h)}</span>
                </div>
                <div className="ticker-stat">
                    <span className="label">24h Low</span>
                    <span className="value low">${formatPrice(tickerData.low24h)}</span>
                </div>
                <div className="ticker-stat">
                    <span className="label">24h Vol</span>
                    <span className="value">{formatVolume(tickerData.volume24h)}</span>
                </div>
            </div>
            <div className="ticker-status">
                <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                <span className="status-text">
                    {isConnected ? 'LIVE' : 'Reconnecting...'}
                </span>
                {lastUpdate && (
                    <span className="last-update">
                        {lastUpdate.toLocaleTimeString()}
                    </span>
                )}
            </div>
        </div>
    );
};

export default LivePriceTicker;
