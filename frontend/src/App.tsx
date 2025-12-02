// import { TradingChart } from './components/Chart/TradingChart';
import AdvancedFinancialChart from './components/Chart/D3Chart';
import { useMarketStore } from './store/marketStore';
import { OrderEntry } from './components/OrderEntry';
import { useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SettingsPage from './components/SettingsPage';

import PineScriptPanel from './components/PineScriptPanel';
import { useState } from 'react';

import { useBinanceTicker } from './hooks/useBinanceTicker';

import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import { useAuthStore } from './store/authStore';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { isConnected, connect, disconnect } = useMarketStore();
  const price = useBinanceTicker('BTC/USDT');
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <div className="p-4 flex-shrink-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold">Autarkic Trading Agent</h1>
                  <nav className="flex gap-4 ml-8">
                    <Link to="/" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link>
                    <Link to="/settings" className="text-gray-300 hover:text-white transition-colors">Settings</Link>
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-250px)]">
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <div className="border border-gray-700 p-4 rounded-lg bg-gray-800 flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">BTC/USDT</h2>
                        <span className={`text-xl font-mono ${price ? 'text-green-400' : 'text-gray-400'}`}>
                          {price ? price.toFixed(2) : '---'} <span className="text-sm text-gray-400">USDT</span>
                        </span>
                      </div>
                    </div>
                    <AdvancedFinancialChart data={[]} height={500} />
                  </div>

                  {/* Pine Script Editor Bottom Panel */}
                  <div className={`border border-gray-700 rounded-lg bg-gray-800 transition-all duration-300 ${isEditorMaximized ? 'h-[calc(100vh-100px)] absolute bottom-0 left-0 right-0 z-50 m-4' : isEditorOpen ? 'h-80' : 'h-10'} flex flex-col`}>
                    <div
                      className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700 cursor-pointer hover:bg-gray-700"
                      onClick={() => !isEditorMaximized && setIsEditorOpen(!isEditorOpen)}
                    >
                      <span className="font-semibold text-sm">Pine Script Editor</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{isEditorOpen ? '▼' : '▲'}</span>
                      </div>
                    </div>
                    {isEditorOpen && (
                      <div className="flex-1 min-h-0">
                        <PineScriptPanel
                          isMaximized={isEditorMaximized}
                          onToggleMaximize={() => setIsEditorMaximized(!isEditorMaximized)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <OrderEntry />
                </div>
              </div>
            </div>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold">Autarkic Trading Agent</h1>
                  <nav className="flex gap-4 ml-8">
                    <Link to="/" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link>
                    <Link to="/settings" className="text-gray-300 hover:text-white transition-colors">Settings</Link>
                  </nav>
                </div>
              </div>
              <SettingsPage />
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
}

export default App;
