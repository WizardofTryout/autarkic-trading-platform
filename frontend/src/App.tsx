// import { TradingChart } from './components/Chart/TradingChart';
import AdvancedFinancialChart from './components/Chart/D3Chart';
import { useMarketStore } from './store/marketStore';
import { OrderEntry } from './components/OrderEntry';
import { useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SettingsPage from './components/SettingsPage';

import PineScriptPanel from './components/PineScriptPanel';
import { useState } from 'react';

function App() {
  const { price, isConnected, connect, disconnect } = useMarketStore();
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const initialData = [
    { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 },
    { time: '2018-12-23', open: 45.12, high: 53.90, low: 45.12, close: 48.09 },
    { time: '2018-12-24', open: 60.71, high: 60.71, low: 53.39, close: 59.29 },
    { time: '2018-12-25', open: 68.26, high: 68.26, low: 59.04, close: 60.50 },
    { time: '2018-12-26', open: 67.71, high: 105.85, low: 66.67, close: 91.04 },
    { time: '2018-12-27', open: 91.04, high: 121.40, low: 82.70, close: 111.40 },
    { time: '2018-12-28', open: 111.51, high: 142.83, low: 103.34, close: 131.25 },
    { time: '2018-12-29', open: 131.33, high: 151.17, low: 77.68, close: 96.43 },
    { time: '2018-12-30', open: 106.33, high: 110.20, low: 90.39, close: 98.10 },
    { time: '2018-12-31', open: 109.87, high: 114.69, low: 85.66, close: 111.26 },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
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
            <span className="text-xl font-mono">{price ? price.toFixed(2) : '---'} USDT</span>
          </div>
        </div>

        <Routes>
          <Route path="/" element={
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-250px)]">
              <div className="lg:col-span-3 flex flex-col gap-4">
                <div className="border border-gray-700 p-4 rounded-lg bg-gray-800 flex-1 min-h-0">
                  <h2 className="text-xl mb-2">BTC/USDT</h2>
                  <AdvancedFinancialChart data={initialData} height={500} />
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
          } />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
