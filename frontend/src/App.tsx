import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import AdvancedFinancialChart from './components/Chart/D3Chart';
import { OrderEntry } from './components/OrderEntry';
import PineScriptPanel from './components/PineScriptPanel';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import UserProfile from './components/Auth/UserProfile';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import SettingsPage from './components/SettingsPage';
import SymbolSearch from './components/SymbolSearch';
import ChatPanel from './components/AIAssistant/ChatPanel';
import { useAuthStore } from './store/authStore';
import { useTradingStore } from './store/tradingStore';
import { Bot, LogOut, User, Settings } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { isAuthenticated, logout } = useAuthStore();
  const { symbol, timeframe } = useTradingStore();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentScript, setCurrentScript] = useState('');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-20 h-16">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Autarkic Trader
          </h1>
          {isAuthenticated && <SymbolSearch />}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded-full transition-colors ${isChatOpen ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="AI Assistant"
              >
                <Bot className="w-5 h-5" />
              </button>
              <Link to="/" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link>
              <div className="relative group">
                <button className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors focus:outline-none">
                  <User className="w-5 h-5" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2">
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link to="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-4">
              <Link to="/login" className="text-gray-300 hover:text-white">Login</Link>
              <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">Register</Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />

          <Route path="/" element={
            <ProtectedRoute>
              <div className="flex flex-col h-[calc(100vh-64px)]">
                <div className="flex-1 flex overflow-hidden">
                  {/* Chart Area */}
                  <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
                    <div className="flex-1 relative">
                      <AdvancedFinancialChart
                        data={[]}
                        symbol={symbol}
                        timeframe={timeframe}
                        height={500}
                      />
                    </div>
                    {/* Pine Script Editor Panel */}
                    <div className="h-1/3 border-t border-gray-800 bg-gray-900">
                      <PineScriptPanel onScriptChange={setCurrentScript} />
                    </div>
                  </div>

                  {/* Sidebar (Order Entry) */}
                  <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto">
                    <OrderEntry />
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          } />
        </Routes>

        {/* AI Chat Panel Overlay */}
        {isAuthenticated && (
          <ChatPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            currentScript={currentScript}
          />
        )}
      </main>
    </div>
  );
}

export default App;
