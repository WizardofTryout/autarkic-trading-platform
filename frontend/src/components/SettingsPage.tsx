import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../services/api';
import type { Settings } from '../services/api';
import APIKeyManager from './Settings/APIKeyManager';

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        bitgetApiKey: '', // Legacy, kept for type compatibility but unused in UI
        binanceApiKey: '', // Legacy
        aiApiKey: '',      // Legacy
        ollamaUrl: 'http://localhost:11434',
        investmentPerTrade: 100,
        riskRewardRatio: '1:2',
        stopLoss: 2,
        takeProfit: 4,
        tradeDirection: 'Long',
        leverage: 1
    });

    useEffect(() => {
        getSettings().then(setSettings).catch(console.error);
    }, []);

    const handleSave = () => {
        console.log('Saving settings:', settings);
        saveSettings(settings).then(() => alert('Settings saved!')).catch(console.error);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = event.target;
        setSettings({
            ...settings,
            [id]: type === 'number' ? parseFloat(value) : value,
        });
    };

    return (
        <div className="p-6 text-gray-100 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Settings</h1>

            <div className="space-y-8">
                {/* New API Key Manager */}
                <APIKeyManager />

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
                    <h2 className="text-xl font-semibold mb-6 text-green-400 border-b border-gray-700 pb-2">Trading Parameters</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="investmentPerTrade" className="block text-sm font-medium text-gray-300">Investment per Trade ($)</label>
                            <input
                                id="investmentPerTrade"
                                type="number"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                value={settings.investmentPerTrade}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="riskRewardRatio" className="block text-sm font-medium text-gray-300">Risk/Reward Ratio</label>
                            <input
                                id="riskRewardRatio"
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                value={settings.riskRewardRatio}
                                onChange={handleChange}
                                placeholder="1:2"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="stopLoss" className="block text-sm font-medium text-gray-300">Stop Loss (%)</label>
                            <input
                                id="stopLoss"
                                type="number"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                value={settings.stopLoss}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="takeProfit" className="block text-sm font-medium text-gray-300">Take Profit (%)</label>
                            <input
                                id="takeProfit"
                                type="number"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                value={settings.takeProfit}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="tradeDirection" className="block text-sm font-medium text-gray-300">Trade Direction</label>
                            <select
                                id="tradeDirection"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-white"
                                value={settings.tradeDirection}
                                onChange={handleChange}
                            >
                                <option>Long</option>
                                <option>Short</option>
                                <option>Both</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="leverage" className="block text-sm font-medium text-gray-300">Leverage</label>
                            <input
                                id="leverage"
                                type="number"
                                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                value={settings.leverage}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    onClick={handleSave}
                >
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;
