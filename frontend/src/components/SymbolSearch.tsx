import React, { useState, useEffect } from 'react';
import { getSymbols } from '../services/api';
import { useTradingStore } from '../store/tradingStore';
import { Search } from 'lucide-react';
import { useBinanceWebSocket } from '../hooks/useBinanceWebSocket';

// Component for searching symbols
const SymbolSearch: React.FC = () => {
    const { symbol, setSymbol } = useTradingStore();
    const [symbols, setSymbols] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    // Subscribe to real-time price updates
    const handlePriceUpdate = React.useCallback((data: any) => {
        if (data && data.close) {
            setCurrentPrice(parseFloat(data.close));
        }
    }, []);

    useBinanceWebSocket(symbol, '1m', handlePriceUpdate, { skipStateUpdate: true });

    useEffect(() => {
        const fetchSymbols = async () => {
            setLoading(true);
            try {
                const data = await getSymbols();
                setSymbols(data);
            } catch (error) {
                console.error("Failed to load symbols", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSymbols();
    }, []);

    const filteredSymbols = symbols.filter(s =>
        s.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative w-64">
            <div
                className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-750 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center">
                    <Search className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-white font-medium">{symbol}</span>
                </div>
                {currentPrice && (
                    <span className={`text-sm font-mono ${currentPrice > 0 ? 'text-green-400' : 'text-white'}`}>
                        {currentPrice.toFixed(2)}
                    </span>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50 max-h-96 flex flex-col">
                    <div className="p-2 border-b border-gray-700">
                        <input
                            type="text"
                            className="w-full bg-gray-900 text-white px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
                        ) : filteredSymbols.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">No symbols found</div>
                        ) : (
                            filteredSymbols.map((s) => (
                                <div
                                    key={s}
                                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-700 transition-colors ${s === symbol ? 'bg-blue-900/30 text-blue-400' : 'text-gray-300'}`}
                                    onClick={() => {
                                        setSymbol(s);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    {s}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default SymbolSearch;
