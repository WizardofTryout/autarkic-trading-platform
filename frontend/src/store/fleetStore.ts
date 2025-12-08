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
    macro_strategy_id: string | null;
    micro_strategy_id: string | null;
    macro_timeframe: string;
    micro_timeframe: string;
    created_at: string;
    updated_at: string | null;
    last_signal_at: string | null;
    current_proposal?: TradeProposal | null;
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
    type: 'status' | 'log' | 'proposal' | 'trade' | 'connected' | 'heartbeat' | 'pong';
    agent_id?: string;
    status?: string;
    log?: string;
    visuals?: VisualOverlay[];
    timestamp?: string;
    message?: string;
}

export interface DeployAgentParams {
    name: string;
    symbol: string;
    mode: 'PAPER' | 'LIVE';
    budget: number;
    max_drawdown_percent: number;
    risk_per_trade: number;
    min_rr_ratio: number;
    macro_strategy_id?: string;
    micro_strategy_id?: string;
    macro_timeframe: string;
    micro_timeframe: string;
}

// ==================== Store State ====================

interface FleetState {
    // Data
    agents: TradingAgent[];
    selectedAgentId: string | null;
    agentLogs: Record<string, AgentLog[]>;

    // WebSocket
    wsConnected: boolean;
    wsError: string | null;

    // UI State
    isLoading: boolean;
    error: string | null;
    showDeployModal: boolean;
    showAgentCockpit: boolean;

    // Actions
    fetchAgents: () => Promise<void>;
    deployAgent: (params: DeployAgentParams) => Promise<TradingAgent>;
    startAgent: (agentId: string) => Promise<void>;
    pauseAgent: (agentId: string) => Promise<void>;
    stopAgent: (agentId: string) => Promise<void>;
    deleteAgent: (agentId: string) => Promise<void>;
    approveProposal: (agentId: string, approved: boolean, notes?: string) => Promise<void>;
    fetchAgentLogs: (agentId: string) => Promise<void>;

    // Setters
    selectAgent: (agentId: string | null) => void;
    setShowDeployModal: (show: boolean) => void;
    setShowAgentCockpit: (show: boolean) => void;

    // WebSocket
    connectWebSocket: () => void;
    disconnectWebSocket: () => void;
    handleWebSocketMessage: (message: FleetMessage) => void;
}

// WebSocket instance (outside store to persist across re-renders)
let wsInstance: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useFleetStore = create<FleetState>((set, get) => ({
    // Initial State
    agents: [],
    selectedAgentId: null,
    agentLogs: {},
    wsConnected: false,
    wsError: null,
    isLoading: false,
    error: null,
    showDeployModal: false,
    showAgentCockpit: false,

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

    deployAgent: async (params: DeployAgentParams) => {
        set({ isLoading: true, error: null });
        try {
            const agent = await api.post('/fleet/agents', params);
            set(state => ({
                agents: [...state.agents, agent],
                isLoading: false,
                showDeployModal: false
            }));
            return agent;
        } catch (error: any) {
            console.error('Failed to deploy agent:', error);
            set({ error: error.message || 'Failed to deploy agent', isLoading: false });
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
            set({ error: error.message || 'Failed to start agent' });
            throw error;
        }
    },

    pauseAgent: async (agentId: string) => {
        try {
            await api.post(`/fleet/agents/${agentId}/pause`);
            set(state => ({
                agents: state.agents.map(a =>
                    a.id === agentId ? { ...a, status: 'PAUSED' as AgentStatus } : a
                )
            }));
        } catch (error: any) {
            console.error('Failed to pause agent:', error);
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

    // ==================== Setters ====================

    selectAgent: (agentId: string | null) => {
        set({ selectedAgentId: agentId, showAgentCockpit: agentId !== null });
        if (agentId) {
            get().fetchAgentLogs(agentId);
        }
    },

    setShowDeployModal: (show: boolean) => set({ showDeployModal: show }),
    setShowAgentCockpit: (show: boolean) => set({ showAgentCockpit: show }),

    // ==================== WebSocket ====================

    connectWebSocket: () => {
        if (wsInstance?.readyState === WebSocket.OPEN) {
            return; // Already connected
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
            wsInstance.close();
            wsInstance = null;
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

            case 'log':
                // Add log to agent's log list
                if (message.agent_id) {
                    const newLog: AgentLog = {
                        id: crypto.randomUUID(),
                        agent_id: message.agent_id,
                        timestamp: message.timestamp || new Date().toISOString(),
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
