import { useAuthStore } from '../store/authStore';
// Use relative URL so Vite dev server proxy can intercept and forward to backend
const API_BASE = '/api/v1';

export interface Settings {
    bitgetApiKey: string;
    binanceApiKey: string;
    aiApiKey: string;
    ollamaUrl: string;
}

export interface Strategy {
    id: string;
    name: string;
    source_code: string;
    category?: string;
    is_favorite?: boolean;
    status: string;
    created_at: string;
    type: 'strategy' | 'indicator';
    python_code?: string;
    compiled_at?: string;
}

export interface ActiveStrategy {
    id: string;
    strategy_id: string;
    symbol: string;
    timeframe: string;
    amount: number;
    status: string;
    created_at: string;
    strategy_name: string;
}

export const getSettings = async (): Promise<Settings> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch settings");
    }
    return response.json();
};

export const saveSettings = async (settings: Settings) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        throw new Error("Failed to save settings");
    }
    return response.json();
};

export const saveStrategy = async (strategy: { name: string; script_code: string; python_code?: string }) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            script: strategy.script_code,
            name: strategy.name,
            python_code: strategy.python_code
        }),
    });
    if (!response.ok) throw new Error('Failed to save strategy');
    return response.json();
};

export const executeStrategy = async (script: string, symbol: string = "BTC/USDT", timeframe: string = "1h") => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ script, symbol, timeframe }),
    });
    if (!response.ok) throw new Error('Failed to execute strategy');
    return response.json();
};

export const getMarketData = async (symbol: string, timeframe: string, limit?: number) => {
    try {
        let url = `${API_BASE}/market/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`;
        if (limit !== undefined) {
            url += `&limit=${limit}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch market data: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching market data:', error);
        throw error;
    }
};
export const getStrategies = async () => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
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

export const changePassword = async (oldPassword: string, newPassword: string) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/auth/password-change`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to change password');
    }
    return response.json();
};

// --- API Key Management ---

export interface APIKey {
    key_name: string;
    provider: string;
    model?: string;
    id: string;
    masked_key: string;
    is_valid: boolean;
    last_validated?: string;
}

export interface APIKeyCreate {
    key_name: string;
    provider: string;
    model?: string;
    api_key: string;
}

export const getAPIKeys = async (): Promise<APIKey[]> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings/keys`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch API keys');
    return response.json();
};

export const addAPIKey = async (data: APIKeyCreate): Promise<APIKey> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings/keys`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add API key');
    }
    return response.json();
};

export const deleteAPIKey = async (id: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings/keys/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to delete API key');
};

export const validateAPIKey = async (provider: string, api_key: string, model?: string, ollama_url?: string): Promise<boolean> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/settings/keys/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider, api_key, model, ollama_url }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.is_valid;
};

export const getSymbols = async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE}/market/symbols`);
    if (!response.ok) throw new Error('Failed to fetch symbols');
    return response.json();
};

export const chatWithAI = async (message: string, context?: any, signal?: AbortSignal) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message, context }),
        signal
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'AI Chat failed');
    }
    return response.json();
};

export const generateStrategy = async (
    prompt: string,
    currentCode?: string,
    signal?: AbortSignal,
    mode: 'pinescript' | 'python' = 'pinescript'
) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/ai-strategy/generate_strategy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, current_code: currentCode, mode }),
        signal
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate strategy');
    }
    return response.json();
};

// --- Strategy Management ---

// Interfaces are already defined at the top of the file, removing duplicates here.
// If they are NOT defined at the top, I should move them there.
// Checking the file content via view_file first would be safer, but I can assume based on the lint error that they are duplicated.

// Actually, I will remove the duplicates I just added and ensure they are merged correctly.
// The lint says "Cannot redeclare block-scoped variable 'getStrategies'".
// This means I appended the code instead of replacing the existing one, or I pasted it twice.

// I will read the file first to be sure.

export const createStrategy = async (strategy: { name: string; source_code: string; category?: string; is_favorite?: boolean }) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(strategy),
    });
    if (!response.ok) throw new Error('Failed to create strategy');
    return response.json();
};

export const updateStrategy = async (id: string, updates: Partial<Strategy>) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update strategy');
    return response.json();
};

export const deleteStrategy = async (id: string) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete strategy');
    return response.json();
};

export const activateStrategy = async (data: {
    strategy_id: string;
    symbol: string;
    timeframe: string;
    amount: number;
    risk_per_trade?: number;
    risk_reward_ratio?: number;
    stop_loss_percent?: number;
    use_trailing_stop?: boolean;
    trailing_stop_percent?: number;
}) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/activate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to activate strategy');
    return response.json();
};

export const getActiveStrategies = async (): Promise<ActiveStrategy[]> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch active strategies');
    return response.json();
};

export const stopStrategy = async (activeId: string) => {
    const response = await api.post(`/strategies/stop/${activeId}`);
    return response;
};

export const deleteActiveStrategy = async (activeId: string) => {
    const response = await api.delete(`/strategies/active/${activeId}`);
    return response;
};

export const compileStrategy = async (script: string) => {
    const response = await api.post('/strategies/compile', { script });
    return response;
};

// --- AI Transpiler ---

export const transpilePineScript = async (pineScript: string): Promise<{ python_code: string; status: string }> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/transpile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pine_script: pineScript }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to transpile Pine Script');
    }
    return response.json();
};

export const requestPasswordReset = async (email: string) => {
    const response = await fetch(`${API_BASE}/auth/password-reset-request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        throw new Error('Failed to request password reset');
    }
    return response.json();
};

export const confirmPasswordReset = async (token: string, newPassword: string) => {
    const response = await fetch(`${API_BASE}/auth/password-reset-confirm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to reset password');
    }
    return response.json();
};

export const api = {
    get: async (endpoint: string) => {
        const token = useAuthStore.getState().token;
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error(`GET ${endpoint} failed`);
        return response.json();
    },
    post: async (endpoint: string, data?: any) => {
        const token = useAuthStore.getState().token;
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `POST ${endpoint} failed`);
        }
        return response.json();
    },
    delete: async (endpoint: string) => {
        const token = useAuthStore.getState().token;
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `DELETE ${endpoint} failed`);
        }
        // Handle 204 No Content - don't try to parse empty body
        if (response.status === 204) {
            return null;
        }
        return response.json();
    },
    put: async (endpoint: string, data?: any) => {
        const token = useAuthStore.getState().token;
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `PUT ${endpoint} failed`);
        }
        return response.json();
    }
};

export const getUserPreferences = async () => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/users/me/preferences`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch user preferences');
    return response.json();
};

export const updateUserPreferences = async (preferences: any) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/users/me/preferences`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferences }),
    });
    if (!response.ok) throw new Error('Failed to update user preferences');
    return response.json();
};

export const runBacktest = async (params: {
    python_code: string;  // Changed from 'script' to 'python_code'
    symbol: string;
    timeframe: string;
    start_date: string;
    end_date: string;
    initial_capital: number;
    take_profit?: number;
    stop_loss?: number;
}) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/strategies/backtest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Backtest failed');
    }
    return response.json();
};

export const analyzeMarket = async (symbol: string, timeframe: string, promptType: 'trend' | 'news' | 'custom', customPrompt?: string, signal?: AbortSignal) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/research/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            symbol,
            timeframe,
            prompt_type: promptType,
            custom_prompt: customPrompt
        }),
        signal
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Analysis failed');
    }
    return response.json();
};

// --- Document Management ---

export interface DocumentCreate {
    title: string;
    content: string;
    folder?: string;
    tags?: string[];
}

export interface DocumentResponse {
    id: string;
    title: string;
    content: string;
    folder?: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    user_id: string;
}

export const saveDocument = async (doc: DocumentCreate): Promise<DocumentResponse> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/research/documents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(doc),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to save document');
    }
    return response.json();
};

export const getDocuments = async (): Promise<DocumentResponse[]> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/research/documents`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch documents');
    }
    return response.json();
};

export const deleteDocument = async (id: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE}/research/documents/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to delete document');
    }
};
