import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Key,
    Wallet,
    ToggleLeft,
    ToggleRight,
    TrendingUp,
    Shield,
    ArrowLeft,
    ChevronRight,
    LineChart,
    Bot,
    RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTradingStore } from '../../store/tradingStore';
import { getStrategies, api } from '../../services/api';
import APIKeyManager from '../Settings/APIKeyManager';
import UserProfile from '../Auth/UserProfile';

interface DashboardTab {
    id: string;
    label: string;
    icon: React.ReactNode;
}

interface DashboardStats {
    paperBalance: number;
    totalStrategies: number;
    activeStrategies: number;
    tradingAgents: number;
    openPositions: number;
    unrealizedPnL: number;
}

const UserDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { portfolio, fetchPortfolio, activeStrategies, fetchActiveStrategies } = useTradingStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper');
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        paperBalance: 0,
        totalStrategies: 0,
        activeStrategies: 0,
        tradingAgents: 0,
        openPositions: 0,
        unrealizedPnL: 0
    });

    // Fetch dashboard data on mount and periodically
    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoading(true);
            try {
                // Fetch portfolio data
                await fetchPortfolio();
                await fetchActiveStrategies();

                // Fetch strategies count
                const strategies = await getStrategies();

                // Fetch trading agents
                let agents: any[] = [];
                try {
                    agents = await api.get('/fleet/agents');
                } catch (e) {
                    console.log('No fleet agents found');
                }

                setStats(prev => ({
                    ...prev,
                    totalStrategies: strategies?.length || 0,
                    tradingAgents: agents?.length || 0
                }));
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardData();

        // Refresh every 10 seconds
        const interval = setInterval(loadDashboardData, 10000);
        return () => clearInterval(interval);
    }, [fetchPortfolio, fetchActiveStrategies]);

    // Update stats when portfolio changes
    useEffect(() => {
        if (portfolio) {
            // Calculate unrealized PnL from open positions
            let unrealizedPnL = 0;
            if (portfolio.positions && portfolio.positions.length > 0) {
                unrealizedPnL = portfolio.positions.reduce((total, pos) => {
                    const entryPrice = pos.entry_price || 0;
                    const markPrice = pos.mark_price || entryPrice; // fallback to entry if no mark price
                    const size = pos.size || 0;
                    const side = pos.side?.toUpperCase();

                    // Calculate PnL based on position direction
                    let positionPnL = 0;
                    if (side === 'LONG' || side === 'BUY') {
                        positionPnL = (markPrice - entryPrice) * size;
                    } else if (side === 'SHORT' || side === 'SELL') {
                        positionPnL = (entryPrice - markPrice) * size;
                    }
                    return total + positionPnL;
                }, 0);
            }

            setStats(prev => ({
                ...prev,
                paperBalance: portfolio.balance || 0,
                openPositions: portfolio.positions?.length || 0,
                unrealizedPnL: unrealizedPnL
            }));
        }
    }, [portfolio]);

    // Update stats when activeStrategies changes
    useEffect(() => {
        setStats(prev => ({
            ...prev,
            activeStrategies: activeStrategies?.length || 0
        }));
    }, [activeStrategies]);

    const tabs: DashboardTab[] = [
        { id: 'overview', label: 'Übersicht', icon: <TrendingUp className="w-5 h-5" /> },
        { id: 'profile', label: 'Profil', icon: <User className="w-5 h-5" /> },
        { id: 'api-keys', label: 'API Keys', icon: <Key className="w-5 h-5" /> },
        { id: 'strategies', label: 'Strategien', icon: <LineChart className="w-5 h-5" /> },
        { id: 'security', label: 'Sicherheit', icon: <Shield className="w-5 h-5" /> },
    ];

    const handleTradingModeToggle = () => {
        if (tradingMode === 'paper') {
            // Show warning before switching to live
            const confirmed = window.confirm(
                '⚠️ Warnung: Du wechselst zu LIVE Trading!\n\n' +
                'Im Live-Modus werden echte Trades mit echtem Geld ausgeführt.\n\n' +
                'Bist du sicher, dass du fortfahren möchtest?'
            );
            if (confirmed) {
                setTradingMode('live');
            }
        } else {
            setTradingMode('paper');
        }
    };

    const renderOverview = () => (
        <div className="space-y-6">
            {/* Trading Mode Toggle */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Trading-Modus</h3>
                        <p className="text-gray-400 text-sm mt-1">
                            {tradingMode === 'paper'
                                ? 'Paper Trading - Simulierter Handel ohne echtes Geld'
                                : 'Live Trading - Echter Handel mit echtem Geld'}
                        </p>
                    </div>
                    <button
                        onClick={handleTradingModeToggle}
                        className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all ${tradingMode === 'paper'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/30'
                            : 'bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600/30'
                            }`}
                    >
                        {tradingMode === 'paper' ? (
                            <>
                                <ToggleLeft className="w-6 h-6" />
                                <span>Paper Trading</span>
                            </>
                        ) : (
                            <>
                                <ToggleRight className="w-6 h-6" />
                                <span>Live Trading</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 min-h-[140px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-600/20 rounded-lg">
                            <Wallet className="w-5 h-5 text-green-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-white">${stats.paperBalance.toLocaleString()}</p>
                    <p className={`text-sm mt-1 ${stats.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.unrealizedPnL >= 0 ? '+' : ''}{stats.unrealizedPnL.toFixed(2)} USDT Unrealized
                    </p>
                </div>

                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 min-h-[140px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <LineChart className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Strategien</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalStrategies}</p>
                    <p className="text-blue-400 text-sm mt-1">{stats.activeStrategies} aktiv</p>
                </div>

                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 min-h-[140px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-600/20 rounded-lg">
                            <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Trading Agents</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.tradingAgents}</p>
                    <p className="text-purple-400 text-sm mt-1">Aktive Bots</p>
                </div>

                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 min-h-[140px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-yellow-600/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-yellow-400" />
                        </div>
                        <span className="text-gray-400 text-sm">Offene Positionen</span>
                        {isLoading && <RefreshCw className="w-4 h-4 text-gray-500 animate-spin ml-auto" />}
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.openPositions}</p>
                    <p className="text-gray-400 text-sm mt-1">{stats.activeStrategies} aktive Strategien</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Schnellzugriff</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <LineChart className="w-6 h-6 text-blue-400" />
                        <span className="text-sm text-gray-300">Chart öffnen</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('strategies')}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <TrendingUp className="w-6 h-6 text-green-400" />
                        <span className="text-sm text-gray-300">Strategien</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('api-keys')}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <Key className="w-6 h-6 text-yellow-400" />
                        <span className="text-sm text-gray-300">API Keys</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <Shield className="w-6 h-6 text-purple-400" />
                        <span className="text-sm text-gray-300">Sicherheit</span>
                    </button>
                </div>
            </div>

            {/* Account Info */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Account-Informationen</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-400 text-sm">Benutzername</p>
                        <p className="text-white font-medium">{user?.username || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">E-Mail</p>
                        <p className="text-white font-medium">{user?.email || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-6">Profil-Einstellungen</h3>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Benutzername</label>
                        <input
                            type="text"
                            value={user?.username || ''}
                            disabled
                            className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">E-Mail</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600"
                        />
                    </div>
                </div>
                <p className="text-gray-500 text-sm">
                    Profildaten können derzeit nicht geändert werden. Kontaktiere den Support für Änderungen.
                </p>
            </div>
        </div>
    );

    const renderApiKeys = () => (
        <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-semibold text-white mb-2">API Key Verwaltung</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Verwalte deine API Keys für KI-Dienste und Börsen.
                </p>
                <APIKeyManager />
            </div>
        </div>
    );

    const renderStrategies = () => (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">Strategie-Verwaltung</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <LineChart className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-white font-medium">Gespeicherte Strategien</p>
                            <p className="text-gray-400 text-sm">{stats.totalStrategies} Strategien verfügbar</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { window.location.href = '/?tab=strategy'; }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <span>Strategy Builder</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-600/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-white font-medium">Aktive Strategien</p>
                            <p className="text-gray-400 text-sm">{stats.activeStrategies} Strategien laufen</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { window.location.href = '/?tab=strategy'; }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                    >
                        <span>Verwalten</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-600/20 rounded-lg">
                            <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-white font-medium">Trading Agents</p>
                            <p className="text-gray-400 text-sm">{stats.tradingAgents} Agents konfiguriert</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { window.location.href = '/?tab=fleet'; }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                    >
                        <span>Fleet Dashboard</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSecurity = () => (
        <div className="space-y-6">
            <UserProfile />
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'profile':
                return renderProfile();
            case 'api-keys':
                return renderApiKeys();
            case 'strategies':
                return renderStrategies();
            case 'security':
                return renderSecurity();
            default:
                return renderOverview();
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800 h-14 flex items-center px-6">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Zurück zum Trading</span>
                </button>
            </header>

            {/* Main Content */}
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-[calc(100vh-3.5rem)]">
                    <div className="p-4">
                        <h2 className="text-xl font-bold text-white mb-6">User Dashboard</h2>
                        <nav className="space-y-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                        }`}
                                >
                                    {tab.icon}
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Trading Mode Indicator */}
                    <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-800">
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${tradingMode === 'paper'
                            ? 'bg-blue-900/30 border border-blue-700/50'
                            : 'bg-red-900/30 border border-red-700/50'
                            }`}>
                            <div className={`w-3 h-3 rounded-full ${tradingMode === 'paper' ? 'bg-blue-400' : 'bg-red-400 animate-pulse'
                                }`} />
                            <span className={`text-sm font-medium ${tradingMode === 'paper' ? 'text-blue-300' : 'text-red-300'
                                }`}>
                                {tradingMode === 'paper' ? 'Paper Trading' : 'LIVE Trading'}
                            </span>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 p-6 overflow-auto">
                    <div className="max-w-4xl mx-auto">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default UserDashboard;
