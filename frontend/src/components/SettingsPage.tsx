import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getUserPreferences, updateUserPreferences } from '../services/api';
import type { Settings } from '../services/api';
import APIKeyManager from './Settings/APIKeyManager';

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        bitgetApiKey: '', // Legacy, kept for type compatibility but unused in UI
        binanceApiKey: '', // Legacy
        aiApiKey: '',      // Legacy
        ollamaUrl: 'http://localhost:11434'
    });
    const [timezone, setTimezone] = useState<string>('UTC');

    useEffect(() => {
        getSettings().then(setSettings).catch(console.error);
        getUserPreferences().then((prefs: any) => {
            if (prefs.timezone) {
                setTimezone(prefs.timezone);
            } else {
                // Detect user's timezone
                const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                setTimezone(detectedTz);
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        try {
            console.log('Saving settings:', settings);
            await saveSettings(settings);
            await updateUserPreferences({ timezone });
            alert('Settings saved!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        }
    };



    return (
        <div className="p-6 text-gray-100 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-white">Settings</h1>

            <div className="space-y-8">
                {/* New API Key Manager */}
                <APIKeyManager />

                {/* Timezone Settings */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-white">Timezone Settings</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Your Timezone
                            </label>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <optgroup label="Europe">
                                    <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                                    <option value="Europe/Zurich">Europe/Zurich (CET/CEST)</option>
                                </optgroup>
                                <optgroup label="Americas">
                                    <option value="America/New_York">America/New York (EST/EDT)</option>
                                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                                    <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                                </optgroup>
                                <optgroup label="Asia">
                                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                                    <option value="Asia/Hong_Kong">Asia/Hong Kong (HKT)</option>
                                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                                </optgroup>
                                <optgroup label="Other">
                                    <option value="UTC">UTC</option>
                                </optgroup>
                            </select>
                            <p className="mt-2 text-sm text-gray-400">
                                All timestamps will be displayed in your selected timezone.
                            </p>
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
