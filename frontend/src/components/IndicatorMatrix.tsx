import React, { useState, useEffect } from 'react';
import { X, Search, Star, Code, Play } from 'lucide-react';
import { getStrategies } from '../services/api';

interface Strategy {
    id: string;
    name: string;
    category: string;
    is_favorite: boolean;
}

interface IndicatorMatrixProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (strategyId: string) => void;
}

const IndicatorMatrix: React.FC<IndicatorMatrixProps> = ({ isOpen, onClose, onSelect }) => {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'built-in'>('all');

    useEffect(() => {
        if (isOpen) {
            loadStrategies();
        }
    }, [isOpen]);

    const loadStrategies = async () => {
        try {
            const data = await getStrategies();
            console.log('Loaded strategies:', data);
            setStrategies(data);
        } catch (error) {
            console.error('Failed to load strategies:', error);
        }
    };

    const filteredStrategies = strategies.filter(strategy => {
        const matchesSearch = strategy.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab =
            activeTab === 'all' ? true :
                activeTab === 'favorites' ? strategy.is_favorite :
                    activeTab === 'built-in' ? strategy.category === 'Built-in' : true;
        return matchesSearch && matchesTab;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Indicators & Strategies</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Search & Tabs */}
                <div className="p-4 border-b border-gray-800 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search indicators..."
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'favorites', 'built-in'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredStrategies.map((strategy) => (
                        <div key={strategy.id} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg group transition-colors">
                            <div className="flex items-center gap-3">
                                <button className={`text-gray-500 hover:text-yellow-500 transition-colors ${strategy.is_favorite ? 'text-yellow-500' : ''}`}>
                                    <Star size={18} />
                                </button>
                                <div>
                                    <h3 className="text-white font-medium">{strategy.name}</h3>
                                    <span className="text-xs text-gray-500">{strategy.category}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-gray-400 hover:text-white" title="View Source">
                                    <Code size={18} />
                                </button>
                                <button
                                    onClick={() => onSelect(strategy.id)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5"
                                >
                                    <Play size={14} />
                                    Add to Chart
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default IndicatorMatrix;
