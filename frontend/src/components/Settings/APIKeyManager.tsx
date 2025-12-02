import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Check, X, Loader2, Key } from 'lucide-react';
import { getAPIKeys, addAPIKey, deleteAPIKey } from '../../services/api';
import type { APIKey } from '../../services/api';

const APIKeyManager: React.FC = () => {
    const [keys, setKeys] = useState<APIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newKey, setNewKey] = useState({
        key_name: '',
        provider: 'gemini',
        model: '',
        api_key: ''
    });

    const fetchKeys = async () => {
        try {
            const data = await getAPIKeys();
            setKeys(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        setError(null);
        try {
            await addAPIKey(newKey);
            setNewKey({ key_name: '', provider: 'gemini', model: '', api_key: '' });
            await fetchKeys();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add API key. Validation may have failed.');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (!confirm('Are you sure you want to delete this key?')) return;
        try {
            await deleteAPIKey(id);
            setKeys(keys.filter(k => k.id !== id));
        } catch (err) {
            console.error(err);
            setError('Failed to delete key');
        }
    };

    const getProviderColor = (provider: string) => {
        switch (provider) {
            case 'gemini': return 'text-blue-400';
            case 'openai': return 'text-green-400';
            case 'anthropic': return 'text-purple-400';
            case 'ollama': return 'text-orange-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-700 pb-2">
                <Key className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-semibold text-white">AI/LLM API Keys</h2>
            </div>

            <p className="text-gray-400 text-sm mb-6">
                Add your API keys for AI providers (Google Gemini, OpenAI, etc.) to enable automatic code suggestions and AI-assisted analysis.
                Keys are encrypted and stored securely.
            </p>

            {/* Add Key Form */}
            <form onSubmit={handleAddKey} className="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Key Name (e.g. My Gemini)</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newKey.key_name}
                            onChange={(e) => setNewKey({ ...newKey, key_name: e.target.value })}
                            placeholder="My Key"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Provider</label>
                        <select
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newKey.provider}
                            onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic Claude</option>
                            <option value="ollama">Ollama (Local)</option>
                            <option value="binance">Binance</option>
                            <option value="bitget">Bitget</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Model (Optional)</label>
                        <input
                            type="text"
                            list="model-suggestions"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newKey.model}
                            onChange={(e) => setNewKey({ ...newKey, model: e.target.value })}
                            placeholder={newKey.provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash'}
                        />
                        <datalist id="model-suggestions">
                            <option value="gemini-2.5-flash" />
                            <option value="gemini-2.0-flash-exp" />
                            <option value="gemini-1.5-pro" />
                            <option value="gemini-1.5-flash" />
                            <option value="gpt-4o" />
                            <option value="gpt-4-turbo" />
                            <option value="claude-3-opus-20240229" />
                            <option value="claude-3-sonnet-20240229" />
                            <option value="llama3" />
                            <option value="mistral" />
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">API Key</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newKey.api_key}
                            onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })}
                            placeholder="sk-..."
                        />
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <button
                    type="submit"
                    disabled={adding}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add API Key
                </button>
            </form>

            {/* Keys List */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Stored Keys ({keys.length})</h3>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    </div>
                ) : keys.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No keys added yet.</p>
                ) : (
                    keys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-4">
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase bg-gray-800 border border-gray-700 ${getProviderColor(key.provider)}`}>
                                    {key.provider}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-white">{key.key_name}</p>
                                        {key.model && <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{key.model}</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono">{key.masked_key}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${key.is_valid ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                    {key.is_valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    {key.is_valid ? 'Valid' : 'Invalid'}
                                </div>
                                <button
                                    onClick={() => handleDeleteKey(key.id)}
                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-full transition-colors"
                                    title="Delete Key"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default APIKeyManager;
