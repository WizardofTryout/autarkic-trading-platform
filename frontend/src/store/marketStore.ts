import { create } from 'zustand';

interface MarketState {
    price: number | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
}

export const useMarketStore = create<MarketState>((set) => {
    let socket: WebSocket | null = null;

    return {
        price: null,
        isConnected: false,
        connect: () => {
            if (socket) return;

            socket = new WebSocket('ws://localhost:8000/ws/market');

            socket.onopen = () => {
                console.log('WebSocket Connected');
                set({ isConnected: true });
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'ticker') {
                        set({ price: data.price });
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            socket.onclose = () => {
                console.log('WebSocket Disconnected');
                set({ isConnected: false });
                socket = null;
                // Reconnect logic could go here
            };
        },
        disconnect: () => {
            if (socket) {
                socket.close();
                socket = null;
            }
        },
    };
});
