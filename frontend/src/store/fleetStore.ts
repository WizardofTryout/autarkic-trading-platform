/**
 * Fleet Store - State management for AI Trading Agents
 * 
 * Manages fleet of trading agents, WebSocket connection,
 * and real-time updates for Mission Control UI.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { useAuthStore } from './authStore';

// ==================== Types ====================

export interface TradingAgent {
    id: string;
    name: string;
    symbol: string;
    mode: 'PAPER' | 'LIVE';
    status: AgentStatus;
    budget: number;
    locked_budget: number;
    session_pnl: number;
    total_trades: number;
    winning_trades: number;
    max_drawdown_percent: number;
    risk_per_trade: number;
    min_rr_ratio: number;
    leverage: number;
    margin_mode: 'ISOLATED' | 'CROSS';
    macro_strategy_id: string | null;
    micro_strategy_id: string | null;
    macro_timeframe: string;
    micro_timeframe: string;
    created_at: string;
    updated_at: string | null;
    last_signal_at: string | null;
    current_proposal?: TradeProposal | null;
    active_position?: ActivePosition | null;
    active_positions?: ActivePosition[];
}

export interface ActivePosition {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entry_price: number;
    current_price: number;
    unrealized_pnl: number;
    stop_loss: number | null;
    take_profit: number | null;
    is_trailing_stop: boolean;
    trailing_percent: number | null;
}

export type AgentStatus =
    | 'PAUSED'
    | 'SCANNING'
    | 'PROPOSING'
    | 'AWAITING_APPROVAL'
    | 'ACTIVE'
    | 'IN_POSITION'
    | 'COOLDOWN'
    | 'STOPPED'
    | 'ERROR';

export interface TradeProposal {
    side: 'LONG' | 'SHORT';
    entry: number;
    stop_loss: number;
    take_profit: number;
    position_size: number;
    timestamp: string;
}

export interface AgentLog {
    id: string;
    agent_id: string;
    timestamp: string;
    status: string;
    log_text: string | null;
    visual_snapshot: VisualOverlay[];
    meta_data: Record<string, any>;
}

export interface VisualOverlay {
    shape: 'line' | 'rect' | 'zone';
    price?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    color: string;
    label?: string;
    style?: 'solid' | 'dashed' | 'dotted';
}

export interface FleetMessage {
    type: 'status' | 'log' | 'proposal' | 'trade' | 'connected' | 'heartbeat' | 'pong' | 'agent_update';
    agent_id?: string;
    status?: string;
    log?: string;
    visuals?: VisualOverlay[];
    timestamp?: string;
    message?: string;
    data?: Partial<TradingAgent>;
}

export interface DeployAgentParams {
    name: string;
    symbol: string;
    mode: 'PAPER' | 'LIVE';
    budget: number;
    max_drawdown_percent: number;
    risk_per_trade: number;
    min_rr_ratio: number;
    leverage: number;
    margin_mode: 'ISOLATED' | 'CROSS';
    macro_strategy_id?: string;
    micro_strategy_id?: string;
    macro_timeframe: string;
    micro_timeframe: string;
}

// ==================== Store State ====================

interface BudgetInfo {
    balance: number;           // Free capital available
    locked_balance: number;    // Capital allocated to agents
    total_capital: number;     // Total capital (balance + locked_balance)
}

interface FleetState {
    // Data
    agents: TradingAgent[];
    selectedAgentId: string | null;
    agentLogs: Record<string, AgentLog[]>;
    budgetInfo: BudgetInfo | null;
    currentPrices: Record<string, number>; // symbol -> current price

    // WebSocket
    wsConnected: boolean;
    wsError: string | null;

    // UI State
    isLoading: boolean;
    error: string | null;
    showAgentCockpit: boolean;

    deployWizardState: {
        step: number;
        isOpen: boolean;
        data: DeployAgentParams;
    };

    // Actions
    fetchAgents: () => Promise<void>;
    fetchBudgetInfo: () => Promise<void>;
    deployAgent: (params: DeployAgentParams) => Promise<TradingAgent>;
    updateAgent: (agentId: string, updates: Partial<TradingAgent>) => Promise<void>;
    startAgent: (agentId: string) => Promise<void>;
    pauseAgent: (agentId: string) => Promise<void>;
    stopAgent: (agentId: string) => Promise<void>;
    deleteAgent: (agentId: string) => Promise<void>;
    approveProposal: (agentId: string, approved: boolean, notes?: string) => Promise<void>;
    fetchAgentLogs: (agentId: string) => Promise<void>;
    closePosition: (positionId: string) => Promise<void>;

    // Setters
    selectAgent: (agentId: string | null) => void;
    setShowDeployModal: (show: boolean) => void;
    setDeployWizardStep: (step: number) => void;
    updateDeployWizardData: (data: Partial<DeployAgentParams>) => void;
    resetDeployWizard: () => void;
    setShowAgentCockpit: (show: boolean) => void;

    // WebSocket
    connectWebSocket: () => void;
    disconnectWebSocket: () => void;
    handleWebSocketMessage: (message: FleetMessage) => void;

    // Backtest
    backtestVisuals: Record<string, { macro: VisualOverlay[], micro: VisualOverlay[] } | null>;
    fetchBacktestSnapshot: (agentId: string) => Promise<void>;
}

// WebSocket instance (outside store to persist across re-renders)
let wsInstance: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useFleetStore = create<FleetState>((set, get) => ({
    // Initial State
    agents: [],
    selectedAgentId: null,
    agentLogs: {},
    budgetInfo: null,
    currentPrices: {},
    wsConnected: false,
    wsError: null,
    isLoading: false,
    error: null,
    backtestVisuals: {},
    showAgentCockpit: false,

    deployWizardState: {
        step: 1,
        isOpen: false,
        data: {
            name: '',
            symbol: 'BTC/USDT',
            mode: 'PAPER',
            budget: 1000,
            max_drawdown_percent: 10,
            risk_per_trade: 0.01,
            min_rr_ratio: 2,
            leverage: 10,
            margin_mode: 'ISOLATED',
            macro_strategy_id: undefined,
            micro_strategy_id: undefined,
            macro_timeframe: '4h',
            micro_timeframe: '15m',
        }
    },

    // ==================== API Actions ====================

    fetchAgents: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/fleet/agents');
            set({ agents: response.agents || [], isLoading: false });
        } catch (error: any) {
            console.error('Failed to fetch agents:', error);
            const message = error?.message || 'Failed to fetch agents';

            // If auth failed, force logout so the user can re-login and refresh tokens.
            if (message.includes('[401]') || message.includes('[403]')) {
                try {
                    useAuthStore.getState().logout();
                } catch (e) {
                    console.warn('Failed to logout after auth error', e);
                }
            }

            set({ error: message, isLoading: false });
        }
    },

    fetchBudgetInfo: async () => {
        try {
            const budgetInfo = await api.get('/fleet/budget');
            set({ budgetInfo });
        } catch (error: any) {
            console.error('Failed to fetch budget info:', error);
        }
    },

    deployAgent: async (params: DeployAgentParams) => {
        set({ isLoading: true, error: null });
        try {
            const agent = await api.post('/fleet/agents', params);
            
            // Refresh budget info after deployment
            await get().fetchBudgetInfo();
            
            set(state => ({
                agents: [...state.agents, agent],
                isLoading: false,
                // Reset wizard on success
                deployWizardState: {
                    ...state.deployWizardState,
                    step: 1,
                    isOpen: false,
                    data: {
                        name: '',
                        symbol: 'BTC/USDT',
                        mode: 'PAPER',
                        budget: 1000,
                        max_drawdown_percent: 10,
                        risk_per_trade: 0.01,
                        min_rr_ratio: 2,
                        leverage: 10,
                        margin_mode: 'ISOLATED',
                        macro_strategy_id: undefined,
                        micro_strategy_id: undefined,
                        macro_timeframe: '4h',
                        micro_timeframe: '15m',
                    }
                }
            }));
            return agent;
        } catch (error: any) {
            console.error('Failed to deploy agent:', error);
            set({ error: error.message || 'Failed to deploy agent', isLoading: false });
            throw error;
        }
    },

    updateAgent: async (agentId: string, updates: Partial<TradingAgent>) => {
        console.log('[fleetStore] updateAgent called:', { agentId, updates });
        try {
            const updatedAgent = await api.patch(`/fleet/agents/${agentId}`, updates);
            console.log('[fleetStore] updateAgent response:', updatedAgent);
            // Update local state
            set(state => {
                const newAgents = state.agents.map(a =>
                    a.id === agentId ? { ...a, ...updatedAgent } : a
                );
                console.log('[fleetStore] Updated agents list:', newAgents.find(a => a.id === agentId));
                return { agents: newAgents };
            });
        } catch (error: any) {
            console.error('[fleetStore] Failed to update agent:', error);
            set({ error: error.message || 'Failed to update agent' });
            throw error;
        }
    },

    startAgent: async (agentId: string) => {
        try {
            await api.post(`/fleet/agents/${agentId}/start`);
            // Update local state
            set(state => ({
                agents: state.agents.map(a =>
                    a.id === agentId ? { ...a, status: 'SCANNING' as AgentStatus } : a
                )
            }));
        } catch (error: any) {
            console.error('Failed to start agent:', error);
            set({ error: error.message || 'Failed to stop agent' });
            throw error;
        }
    },

    fetchBacktestSnapshot: async (agentId: string) => {
        try {
            const data = await api.post(`/fleet/agents/${agentId}/backtest_snapshot`);
            set(state => ({
                backtestVisuals: {
                    ...state.backtestVisuals,
                    [agentId]: data
                }
            }));
        } catch (error) {
            console.error('Failed to fetch backtest snapshot:', error);
        }
    },

    pauseAgent: async (agentId: string) => {
        console.log('[fleetStore] pauseAgent called for:', agentId);
        try {
            console.log('[fleetStore] Sending POST to:', `/fleet/agents/${agentId}/pause`);
            const response = await api.post(`/fleet/agents/${agentId}/pause`);
            console.log('[fleetStore] Pause response:', response);
            set(state => ({
                agents: state.agents.map(a =>
                    a.id === agentId ? { ...a, status: 'PAUSED' as AgentStatus } : a
                )
            }));
        } catch (error: any) {
            console.error('[fleetStore] Failed to pause agent:', error);
            console.error('[fleetStore] Error details:', {
                message: error.message,
                response: error.response,
                status: error.response?.status,
                data: error.response?.data
            });
            throw error;
        }
    },

    stopAgent: async (agentId: string) => {
        try {
            await api.post(`/fleet/agents/${agentId}/stop`);
            set(state => ({
                agents: state.agents.map(a =>
                    a.id === agentId ? { ...a, status: 'STOPPED' as AgentStatus } : a
                )
            }));
        } catch (error: any) {
            console.error('Failed to stop agent:', error);
            throw error;
        }
    },

    deleteAgent: async (agentId: string) => {
        try {
            await api.delete(`/fleet/agents/${agentId}`);
            
            // Refresh budget info after deletion (budget is released)
            await get().fetchBudgetInfo();
            
            set(state => ({
                agents: state.agents.filter(a => a.id !== agentId),
                selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId
            }));
        } catch (error: any) {
            console.error('Failed to delete agent:', error);
            throw error;
        }
    },

    approveProposal: async (agentId: string, approved: boolean, notes?: string) => {
        try {
            await api.post(`/fleet/agents/${agentId}/approve`, { approved, notes });
            // Status will be updated via WebSocket
        } catch (error: any) {
            console.error('Failed to approve proposal:', error);
            throw error;
        }
    },

    fetchAgentLogs: async (agentId: string) => {
        try {
            const logs = await api.get(`/fleet/agents/${agentId}/logs?limit=100`);
            set(state => ({
                agentLogs: { ...state.agentLogs, [agentId]: logs }
            }));
        } catch (error: any) {
            console.error('Failed to fetch agent logs:', error);
        }
    },

    closePosition: async (positionId: string) => {
        try {
            await api.post(`/paper/positions/${positionId}/close`);
            // Refresh agents to reflect closed position
            await get().fetchAgents();
        } catch (err: any) {
            console.error("Failed to close position:", err);
            // Optionally set error state or notify user
        }
    },

    // ==================== Setters ====================

    selectAgent: (agentId: string | null) => {
        set({ selectedAgentId: agentId, showAgentCockpit: agentId !== null });
        if (agentId) {
            get().fetchAgentLogs(agentId);
        }
    },

    setShowDeployModal: (show: boolean) => set(state => ({
        deployWizardState: { ...state.deployWizardState, isOpen: show }
    })),

    setDeployWizardStep: (step: number) => set(state => ({
        deployWizardState: { ...state.deployWizardState, step }
    })),

    updateDeployWizardData: (data: Partial<DeployAgentParams>) => set(state => ({
        deployWizardState: {
            ...state.deployWizardState,
            data: { ...state.deployWizardState.data, ...data }
        }
    })),

    resetDeployWizard: () => set(() => ({
        deployWizardState: {
            step: 1,
            isOpen: false,
            data: {
                name: '',
                symbol: 'BTC/USDT',
                mode: 'PAPER',
                budget: 1000,
                max_drawdown_percent: 10,
                risk_per_trade: 0.01,
                min_rr_ratio: 2,
                macro_strategy_id: undefined,
                micro_strategy_id: undefined,
                macro_timeframe: '4h',
                micro_timeframe: '15m',
            }
        }
    })),

    setShowAgentCockpit: (show: boolean) => set({ showAgentCockpit: show }),

    // ==================== WebSocket ====================

    connectWebSocket: () => {
        if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
            return; // Already connected or connecting
        }

        const token = useAuthStore.getState().token;
        if (!token) {
            console.warn('No token available for Fleet WebSocket');
            return;
        }

        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000/api/v1/fleet/ws/stream?token=${token}`;

        try {
            wsInstance = new WebSocket(wsUrl);

            wsInstance.onopen = () => {
                console.log('Fleet WebSocket connected');
                set({ wsConnected: true, wsError: null });
            };

            wsInstance.onmessage = (event) => {
                try {
                    const message: FleetMessage = JSON.parse(event.data);
                    get().handleWebSocketMessage(message);
                } catch (e) {
                    console.warn('Invalid Fleet WebSocket message:', event.data);
                }
            };

            wsInstance.onerror = (error) => {
                console.error('Fleet WebSocket error:', error);
                set({ wsError: 'WebSocket connection error' });
            };

            wsInstance.onclose = (event) => {
                console.log('Fleet WebSocket closed:', event.code);
                set({ wsConnected: false });
                wsInstance = null;

                // Attempt reconnect after 5 seconds
                if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
                wsReconnectTimer = setTimeout(() => {
                    if (!wsInstance) {
                        get().connectWebSocket();
                    }
                }, 5000);
            };

        } catch (error: any) {
            console.error('Failed to create WebSocket:', error);
            set({ wsError: error.message });
        }
    },

    disconnectWebSocket: () => {
        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
            wsReconnectTimer = null;
        }
        if (wsInstance) {
            const ws = wsInstance;
            wsInstance = null; // Clear global reference immediately

            // Remove all active listeners
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;

            if (ws.readyState === WebSocket.CONNECTING) {
                // If still connecting, wait for open then close to avoid "closed before established" error
                ws.onopen = () => {
                    try { ws.close(); } catch (e) { }
                };
            } else {
                ws.onopen = null;
                ws.close();
            }
        }
        set({ wsConnected: false });
    },

    handleWebSocketMessage: (message: FleetMessage) => {
        switch (message.type) {
            case 'status':
                // Update agent status
                if (message.agent_id && message.status) {
                    set(state => ({
                        agents: state.agents.map(a =>
                            a.id === message.agent_id
                                ? { ...a, status: message.status as AgentStatus }
                                : a
                        )
                    }));
                }
                break;

            case 'agent_update':
                // Update full agent data
                if (message.agent_id && message.data) {
                    set(state => ({
                        agents: state.agents.map(a =>
                            a.id === message.agent_id
                                ? { ...a, ...message.data }
                                : a
                        )
                    }));
                }
                break;

            case 'log':
                // Add log to agent's log list
                if (message.agent_id) {
                    // ALWAYS use client timestamp for accurate local time display
                    // Backend timestamps are in UTC and cause timezone display issues
                    const newLog: AgentLog = {
                        id: crypto.randomUUID(),
                        agent_id: message.agent_id,
                        timestamp: new Date().toISOString(),
                        status: message.status || '',
                        log_text: message.log || null,
                        visual_snapshot: message.visuals || [],
                        meta_data: {}
                    };

                    set(state => ({
                        agentLogs: {
                            ...state.agentLogs,
                            [message.agent_id!]: [
                                newLog,
                                ...(state.agentLogs[message.agent_id!] || []).slice(0, 99)
                            ]
                        }
                    }));
                }
                break;

            case 'proposal':
                // Update agent with proposal
                if (message.agent_id) {
                    set(state => ({
                        agents: state.agents.map(a =>
                            a.id === message.agent_id
                                ? { ...a, status: 'AWAITING_APPROVAL' as AgentStatus }
                                : a
                        )
                    }));
                }
                break;

            case 'heartbeat':
            case 'pong':
            case 'connected':
                // Ignore keepalive messages
                break;

            default:
                console.log('Unknown Fleet WS message type:', message.type);
        }
    }
}));
