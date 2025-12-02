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

export const saveStrategy = async (strategy: Strategy): Promise<Strategy> => {
    // TODO: Implement backend endpoint for strategies
    console.log('Mock saving strategy:', strategy);
    return strategy;
    /*
    const response = await fetch(`${API_BASE}/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy)
    });
    if (!response.ok) throw new Error('Failed to save strategy');
    return response.json();
    */
};
