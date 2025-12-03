import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../services/api';
import type { Settings } from '../services/api';
import APIKeyManager from './Settings/APIKeyManager';

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        bitgetApiKey: '', // Legacy, kept for type compatibility but unused in UI
        binanceApiKey: '', // Legacy
        aiApiKey: '',      // Legacy
        ollamaUrl: 'http://localhost:11434'
    });

    useEffect(() => {
        getSettings().then(setSettings).catch(console.error);
    }, []);

    const handleSave = () => {
        console.log('Saving settings:', settings);
        saveSettings(settings).then(() => alert('Settings saved!')).catch(console.error);
    };



    return (
        <div className="p-6 text-gray-100 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Settings</h1>

            <div className="space-y-8">
                {/* New API Key Manager */}
                <APIKeyManager />


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
