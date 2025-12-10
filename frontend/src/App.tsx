import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Settings, LogOut } from 'lucide-react';
import KlineChartCore from './components/Chart/KlineChartCore';
import { OrderEntry } from './components/OrderEntry';
import DocumentViewer from './components/Analysis/DocumentViewer';
import { BottomPanel } from './components/Layout/BottomPanel';
import ChatPanel from './components/AIAssistant/ChatPanel';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import SettingsPage from './components/SettingsPage';
import UserDashboard from './components/Dashboard/UserDashboard';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useTradingStore } from './store/tradingStore';
import { analyzeMarket } from './services/api';
import SymbolSearch from './components/SymbolSearch';
import StrategyBuilderView from './components/StrategyBuilder/StrategyBuilderView';
import { FleetDashboard } from './components/Fleet';
import { ResearchAgentSidebar } from './components/Research/ResearchAgentSidebar';
import DocumentExplorer from './components/Research/DocumentExplorer';
import type { DocumentResponse } from './services/api';

function App() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { symbol, timeframe, setSymbol, setTimeframe } = useTradingStore();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentScript, setCurrentScript] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'analysis' | 'strategy' | 'fleet'>('chart');
  const [chatInitialMessage, setChatInitialMessage] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [currentDocument, setCurrentDocument] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLoadDocument = (doc: DocumentResponse) => {
    setCurrentDocument(doc.content);
    // Also set currentAnalysis so the ChatPanel context is updated
    setCurrentAnalysis(doc.content);
    setActiveTab('analysis');
  };

  const handleSaveSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleClearDocument = () => {
    setCurrentAnalysis('');
    setCurrentDocument('');
  };

  const handleLogout = () => {
    logout();
  };


  const navigate = useNavigate();
  const location = useLocation();

  const handleTabChange = (tab: 'chart' | 'analysis' | 'strategy' | 'fleet') => {
    setActiveTab(tab);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 h-14 flex items-center justify-between px-4 flex-none z-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Autarkic Trader
            </span>
          </div>

          {isAuthenticated && <SymbolSearch />}


        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Navigation Tabs */}
              <nav className="flex items-center gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50 mr-4">
                <button
                  onClick={() => handleTabChange('chart')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'chart' && location.pathname === '/'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                >
                  Chart
                </button>
                <button
                  onClick={() => handleTabChange('analysis')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'analysis' && location.pathname === '/'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                >
                  Analysis
                </button>
                <button
                  onClick={() => handleTabChange('strategy')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'strategy' && location.pathname === '/'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                >
                  Strategy Builder
                </button>
                <button
                  onClick={() => handleTabChange('fleet')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'fleet' && location.pathname === '/'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                >
                  🤖 Fleet
                </button>
              </nav>
              <a
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-1.5 bg-gray-800/50 rounded-full border border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600 transition-all cursor-pointer"
                title="User Dashboard"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-300">{user?.username}</span>
              </a>

              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded-lg transition-all duration-200 ${isChatOpen
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                title="AI Assistant"
              >
                <div className="w-5 h-5">🤖</div>
              </button>

              <a href="/settings" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </a>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <a href="/login" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              Login
            </a>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {activeTab === 'fleet' ? (
                <FleetDashboard />
              ) : activeTab === 'strategy' ? (
                <StrategyBuilderView />
              ) : (
                <div className="flex-1 flex overflow-hidden">
                  {/* Left Sidebar (Navigation/Docs) */}
                  {activeTab === 'analysis' && (
                    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                      <DocumentExplorer onLoadDocument={handleLoadDocument} refreshTrigger={refreshTrigger} />
                    </div>
                  )}

                  {/* Main Content Area */}
                  <div className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
                    {/* Chart Area */}
                    <div className="flex-1 relative flex flex-col min-h-0">
                      {activeTab === 'chart' ? (
                        <>
                          <div className="flex-1 min-h-0">
                            <KlineChartCore symbol={symbol} timeframe={timeframe} />
                          </div>

                          {/* Embedded AI Assistant */}
                          {isAuthenticated && isChatOpen && (
                            <div className="h-[400px] flex-none border-t border-gray-800">
                              <ChatPanel
                                isOpen={isChatOpen}
                                onClose={() => setIsChatOpen(false)}
                                currentScript={currentScript}
                                initialMessage={chatInitialMessage}
                                analysisContext={currentAnalysis}
                                onLoadCode={(code) => {
                                  setCurrentScript(code);
                                }}
                                layoutMode="embedded"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        // Analysis View: Split Layout (Chart Top 40%, Doc Bottom 60%)
                        <div className="flex-col h-full flex">
                          <div className="h-[40%] border-b border-gray-800 min-h-0">
                            <KlineChartCore symbol={symbol} timeframe={timeframe} />
                          </div>
                          <div className="flex-1 min-h-0 overflow-hidden">
                            <DocumentViewer
                              initialContent={currentDocument || currentAnalysis}
                              onSaveSuccess={handleSaveSuccess}
                              onClear={handleClearDocument}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Panel (Dashboard / Pine Editor) - Only visible in Chart mode */}
                    {activeTab === 'chart' && (
                      <BottomPanel
                        onScriptChange={setCurrentScript}
                        script={currentScript}
                      />
                    )}
                  </div>

                  {/* Right Sidebar (Order Entry OR Research Agent) */}
                  <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto">
                    {activeTab === 'analysis' ? (
                      <ResearchAgentSidebar
                        isAnalyzing={isAnalyzing}
                        onStop={() => {
                          if (abortControllerRef.current) {
                            abortControllerRef.current.abort();
                            abortControllerRef.current = null;
                            setIsAnalyzing(false);
                          }
                        }}
                        onAnalyze={async (type, prompt) => {
                          try {
                            setIsAnalyzing(true);
                            // Create new AbortController
                            const controller = new AbortController();
                            abortControllerRef.current = controller;

                            const result = await analyzeMarket(symbol, timeframe, type, prompt, controller.signal);

                            // Append new result to existing analysis or replace? 
                            // For now, let's append with a timestamp/separator to create a "chat" feel
                            const timestamp = new Date().toLocaleTimeString();
                            const newEntry = `\n\n\n\n> **Request:** ${prompt}\n\n**Analysis (${timestamp})**\n\n${result.content}`;

                            const newContent = currentAnalysis ? currentAnalysis + newEntry : result.content;
                            setCurrentAnalysis(newContent);
                            setCurrentDocument(newContent); // Keep them in sync for saving
                          } catch (error: any) {
                            if (error.name === 'AbortError') {
                              console.log('Analysis aborted');
                            } else {
                              console.error("Analysis failed", error);
                            }
                          } finally {
                            setIsAnalyzing(false);
                            abortControllerRef.current = null;
                          }
                        }}
                      />
                    ) : (
                      <OrderEntry />
                    )}
                  </div>
                </div>
              )}
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
}

export default App;
