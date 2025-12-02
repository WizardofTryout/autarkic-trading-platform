const API_BASE = 'http://localhost:8000/api/v1';

export interface Settings {
    bitgetApiKey: string;
    binanceApiKey: string;
    aiApiKey: string;
    ollamaUrl: string;
    investmentPerTrade: number;
    riskRewardRatio: string;
    stopLoss: number;
    takeProfit: number;
    tradeDirection: 'Long' | 'Short' | 'Both';
    leverage: number;
}

export interface Strategy {
    id?: number;
    name: string;
    script_code: string;
}

export const getSettings = async (): Promise<Settings> => {
    const response = await fetch(`${API_BASE}/settings`);
    if (!response.ok) {
        throw new Error("Failed to fetch settings");
    }
    return response.json();
};

export const saveSettings = async (settings: Settings) => {
    const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        throw new Error("Failed to save settings");
    }
    return response.json();
};

export const saveStrategy = async (strategy: { name: string; script_code: string }) => {
    const response = await fetch(`${API_BASE}/strategies/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script: strategy.script_code }),
    });
    if (!response.ok) throw new Error('Failed to save strategy');
    return response.json();
};

export const executeStrategy = async (script: string, symbol: string = "BTC/USDT", timeframe: string = "1h") => {
    const response = await fetch(`${API_BASE}/strategies/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script, symbol, timeframe }),
    });
    if (!response.ok) throw new Error('Failed to execute strategy');
    return response.json();
};

export const getMarketData = async (symbol: string = "BTC/USDT", timeframe: string = "1h") => {
    const response = await fetch(`${API_BASE}/market/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
    return response.json();
};

export const getStrategies = async () => {
    const response = await fetch(`${API_BASE}/strategies/`);
    if (!response.ok) {
        throw new Error('Failed to fetch strategies');
    }
    return response.json();
};
export const login = async (email: string, password: string) => {
    const formData = new FormData();
    formData.append('username', email); // OAuth2 expects 'username'
    formData.append('password', password);

    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
};

export const register = async (email: string, password: string, username: string) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
    }
    return response.json();
};
