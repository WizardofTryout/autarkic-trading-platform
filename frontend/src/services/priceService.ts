/**
 * Price Service - Manages live price WebSocket connections for multiple symbols
 * 
 * Subscribes to Binance WebSocket streams and updates prices in real-time.
 */

type PriceUpdateCallback = (symbol: string, price: number) => void;

class PriceService {
    private connections: Map<string, WebSocket> = new Map();
    private callbacks: Set<PriceUpdateCallback> = new Set();
    private prices: Map<string, number> = new Map();

    /**
     * Subscribe to price updates for a symbol
     */
    subscribe(symbol: string) {
        if (this.connections.has(symbol)) {
            return; // Already subscribed
        }

        const binanceSymbol = this.formatSymbolForBinance(symbol);
        const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol}@ticker`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`[PriceService] Connected to ${symbol}`);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.e === '24hrTicker') {
                    const price = parseFloat(data.c);
                    this.prices.set(symbol, price);
                    
                    // Notify all callbacks
                    this.callbacks.forEach(callback => {
                        callback(symbol, price);
                    });
                }
            } catch (error) {
                console.error(`[PriceService] Parse error for ${symbol}:`, error);
            }
        };

        ws.onerror = (error) => {
            console.error(`[PriceService] WebSocket error for ${symbol}:`, error);
        };

        ws.onclose = () => {
            console.log(`[PriceService] WebSocket closed for ${symbol}`);
            this.connections.delete(symbol);
        };

        this.connections.set(symbol, ws);
    }

    /**
     * Unsubscribe from a symbol
     */
    unsubscribe(symbol: string) {
        const ws = this.connections.get(symbol);
        if (ws) {
            ws.close();
            this.connections.delete(symbol);
        }
    }

    /**
     * Add a callback for price updates
     */
    onPriceUpdate(callback: PriceUpdateCallback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback); // Return cleanup function
    }

    /**
     * Get current price for a symbol
     */
    getPrice(symbol: string): number | null {
        return this.prices.get(symbol) || null;
    }

    /**
     * Cleanup all connections
     */
    cleanup() {
        this.connections.forEach((ws) => {
            ws.close();
        });
        this.connections.clear();
        this.callbacks.clear();
        this.prices.clear();
    }

    private formatSymbolForBinance(symbol: string): string {
        return symbol.replace('/', '').toLowerCase();
    }
}

// Singleton instance
export const priceService = new PriceService();
