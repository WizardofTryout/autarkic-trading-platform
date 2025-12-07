/**
 * BinanceDatafeed - Custom Datafeed für KlineCharts Pro
 * 
 * Implementiert das Datafeed-Interface für KlineCharts Pro,
 * nutzt unser Backend für historische Daten und Binance WebSocket für Live-Updates.
 */

import type { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from '@klinecharts/pro';
import { getMarketData } from './api';

// Mapping für Timeframe-Konvertierung (nicht mehr direkt genutzt, da periodToTimeframe die Konvertierung übernimmt)

// Konvertiert KlineCharts Period zu unserem Backend-Timeframe
function periodToTimeframe(period: Period): string {
    const { multiplier, timespan } = period;
    const timespanShort: Record<string, string> = {
        'second': 's',
        'minute': 'm',
        'hour': 'h',
        'day': 'd',
        'week': 'w',
        'month': 'M',
    };
    return `${multiplier}${timespanShort[timespan] || timespan}`;
}

// Konvertiert Symbol von KlineCharts Format zu unserem Format
function formatSymbolForBackend(symbol: SymbolInfo): string {
    // KlineCharts: { ticker: 'BTC/USDT', ... }
    // Unser Backend erwartet: 'BTC/USDT'
    return symbol.ticker;
}

// Konvertiert Symbol für Binance WebSocket
function formatSymbolForBinance(symbol: string): string {
    // 'BTC/USDT' -> 'btcusdt'
    return symbol.replace('/', '').toLowerCase();
}

export class BinanceDatafeed implements Datafeed {
    private subscriptions: Map<string, WebSocket> = new Map();

    /**
     * Sucht nach Symbolen (für Symbol-Suchfunktion)
     */
    async searchSymbols(search?: string): Promise<SymbolInfo[]> {
        // Für jetzt geben wir eine statische Liste der häufigsten Crypto-Paare zurück
        // TODO: Vom Backend holen wenn gewünscht
        const symbols: SymbolInfo[] = [
            { ticker: 'BTC/USDT', name: 'Bitcoin / Tether', shortName: 'BTCUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'ETH/USDT', name: 'Ethereum / Tether', shortName: 'ETHUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'BNB/USDT', name: 'Binance Coin / Tether', shortName: 'BNBUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'SOL/USDT', name: 'Solana / Tether', shortName: 'SOLUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'XRP/USDT', name: 'Ripple / Tether', shortName: 'XRPUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'DOGE/USDT', name: 'Dogecoin / Tether', shortName: 'DOGEUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'ADA/USDT', name: 'Cardano / Tether', shortName: 'ADAUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'AVAX/USDT', name: 'Avalanche / Tether', shortName: 'AVAXUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'DOT/USDT', name: 'Polkadot / Tether', shortName: 'DOTUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
            { ticker: 'LINK/USDT', name: 'Chainlink / Tether', shortName: 'LINKUSDT', exchange: 'BINANCE', market: 'crypto', priceCurrency: 'USDT', type: 'crypto' },
        ];

        if (!search) return symbols;

        const searchLower = search.toLowerCase();
        return symbols.filter(s =>
            s.ticker.toLowerCase().includes(searchLower) ||
            s.name?.toLowerCase().includes(searchLower)
        );
    }

    /**
     * Holt historische Kerzendaten vom Backend
     */
    async getHistoryKLineData(
        symbol: SymbolInfo,
        period: Period,
        from: number,
        to: number
    ): Promise<Array<{
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        turnover?: number;
    }>> {
        try {
            const timeframe = periodToTimeframe(period);
            const symbolStr = formatSymbolForBackend(symbol);

            // Limit berechnen basierend auf Zeitraum (max 500)
            const limit = Math.min(500, Math.ceil((to - from) / (period.multiplier * 60 * 1000)));

            const rawData = await getMarketData(symbolStr, timeframe, limit);

            if (!Array.isArray(rawData)) {
                console.error('Invalid market data response:', rawData);
                return [];
            }

            // Konvertieren zu KlineCharts Format
            return rawData.map((candle: any) => ({
                timestamp: candle.timestamp || new Date(candle.time).getTime(),
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: parseFloat(candle.volume || 0),
                turnover: parseFloat(candle.volume || 0) * parseFloat(candle.close),
            }));
        } catch (error) {
            console.error('Failed to fetch history kline data:', error);
            return [];
        }
    }

    /**
     * Abonniert Live-Updates via Binance WebSocket
     */
    subscribe(
        symbol: SymbolInfo,
        period: Period,
        callback: DatafeedSubscribeCallback
    ): void {
        const timeframe = periodToTimeframe(period);
        const symbolStr = formatSymbolForBinance(symbol.ticker);
        const subscriptionKey = `${symbolStr}_${timeframe}`;

        // Vorherige Subscription beenden wenn vorhanden
        if (this.subscriptions.has(subscriptionKey)) {
            this.subscriptions.get(subscriptionKey)?.close();
        }

        // Binance WebSocket Stream
        const stream = `${symbolStr}@kline_${timeframe}`;
        const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;

        console.log(`KlineCharts subscribing to: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.e === 'kline') {
                    const k = message.k;
                    callback({
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

        this.subscriptions.set(subscriptionKey, ws);
    }

    /**
     * Beendet Live-Updates Subscription
     */
    unsubscribe(symbol: SymbolInfo, period: Period): void {
        const timeframe = periodToTimeframe(period);
        const symbolStr = formatSymbolForBinance(symbol.ticker);
        const subscriptionKey = `${symbolStr}_${timeframe}`;

        if (this.subscriptions.has(subscriptionKey)) {
            this.subscriptions.get(subscriptionKey)?.close();
            this.subscriptions.delete(subscriptionKey);
            console.log(`KlineCharts unsubscribed from: ${subscriptionKey}`);
        }
    }

    /**
     * Cleanup aller Subscriptions
     */
    destroy(): void {
        this.subscriptions.forEach((ws) => ws.close());
        this.subscriptions.clear();
    }
}

// Singleton-Instanz für die gesamte App
export const binanceDatafeed = new BinanceDatafeed();
