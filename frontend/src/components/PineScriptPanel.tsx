import React, { useRef, useState } from 'react';
import { saveStrategy } from '../services/api';

const PineScriptPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [strategyName, setStrategyName] = useState('My Strategy');
  const [pineScriptCode, setPineScriptCode] = useState(`//@version=5
strategy("My Strategy", overlay=true)

// Beispiel Pine Script Code
length = input.int(14, title="RSI Length")
rsi = ta.rsi(close, length)

// Long Entry
if rsi < 30
    strategy.entry("Long", strategy.long)

// Long Exit
if rsi > 70
    strategy.close("Long")
`);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const text = await file.text();
      setPineScriptCode(text);
      // Extract strategy name from script content if possible
      const match = text.match(/strategy\("([^"]+)"/);
      if (match && match[1]) {
        setStrategyName(match[1]);
      }
    }
  };

  const handleSaveScript = async () => {
    setIsUploading(true);
    try {
      await saveStrategy({ name: strategyName, script_code: pineScriptCode });
      console.log('Pine Script saved successfully');
      // Here you might want to trigger a refresh of a strategy list
    } catch (error) {
      console.error('Error saving Pine Script:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 min-h-0">
      <div className="border-b border-gray-700 p-3 sm:p-4 flex-shrink-0 bg-gray-800">
        <h2 className="text-lg sm:text-xl font-bold text-white">Pine Script Editor</h2>
        <div className="flex items-center gap-4 mt-2">
          <label htmlFor="strategyName" className="text-sm font-medium text-gray-300">Strategy Name:</label>
          <input
            id="strategyName"
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            className="bg-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
          />
        </div>
      </div>

      <div className="flex-1 p-0 min-h-0 overflow-hidden relative">
        <textarea
          className="w-full h-full bg-gray-950 text-green-400 p-4 font-mono text-sm resize-none focus:outline-none border-none"
          value={pineScriptCode}
          onChange={(e) => setPineScriptCode(e.target.value)}
          placeholder="Enter your Pine Script code here..."
          spellCheck={false}
        />
      </div>

      <div className="border-t border-gray-700 p-3 sm:p-4 flex-shrink-0 bg-gray-800">
        <div className="flex flex-wrap gap-2 sm:gap-4 justify-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pine,.txt,.ps"
            aria-label="Upload Pine Script file"
          />

          <button
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded flex items-center gap-2 text-sm transition-colors"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            📁 Upload
          </button>

          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-6 rounded flex items-center gap-2 text-sm transition-colors shadow-lg"
            onClick={handleSaveScript}
            disabled={isUploading}
          >
            {isUploading ? 'Processing...' : '💾 Save & Compile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PineScriptPanel;
