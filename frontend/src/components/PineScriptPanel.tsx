import React, { useRef, useState } from 'react';
import { saveStrategy, transpilePineScript } from '../services/api';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Maximize2, Minimize2, Lock, Unlock } from 'lucide-react';
import { NotificationModal } from './Common/NotificationModal';
import TranspilationProgress from './Common/TranspilationProgress';

interface PineScriptPanelProps {
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onScriptChange?: (script: string) => void;
  script?: string; // External script control
  strategyName?: string; // External name control
  onNameChange?: (name: string) => void; // Name change callback
  pythonCode?: string; // External python code
  onPythonCodeChange?: (code: string) => void; // Python code change callback
}

const PineScriptPanel: React.FC<PineScriptPanelProps> = ({
  isMaximized,
  onToggleMaximize,
  onScriptChange,
  script,
  strategyName: externalStrategyName,
  onNameChange,
  pythonCode: externalPythonCode,
  onPythonCodeChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalStrategyName, setInternalStrategyName] = useState('My Strategy');
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
  const [pythonCode, setPythonCode] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTranspiling, setIsTranspiling] = useState(false);
  const [activeTab, setActiveTab] = useState<'pine' | 'python'>('pine');
  const [isPythonUnlocked, setIsPythonUnlocked] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  // Use external name if provided, otherwise use internal state
  const strategyName = externalStrategyName !== undefined ? externalStrategyName : internalStrategyName;
  const currentPythonCode = externalPythonCode !== undefined ? externalPythonCode : pythonCode;

  // Sync external script prop with local state
  React.useEffect(() => {
    if (script !== undefined) {
      setPineScriptCode(script);
    }
  }, [script]);

  // Sync external python code with local state
  React.useEffect(() => {
    if (externalPythonCode !== undefined) {
      setPythonCode(externalPythonCode);
    }
  }, [externalPythonCode]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const text = await file.text();
      setPineScriptCode(text);
      onScriptChange?.(text); // Notify parent
      // Extract strategy name from script content if possible
      const match = text.match(/strategy\("([^"]+)"/);
      if (match && match[1]) {
        if (onNameChange) {
          onNameChange(match[1]);
        } else {
          setInternalStrategyName(match[1]);
        }
      }
    }
  };

  const handleSaveScript = async () => {
    setIsUploading(true);
    try {
      await saveStrategy({ name: strategyName, script_code: pineScriptCode });
      console.log('Pine Script saved successfully');
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Success',
        message: 'Strategy saved successfully! Check the Indicators menu.'
      });
    } catch (error) {
      console.error('Error saving Pine Script:', error);
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to save strategy.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateEngine = async () => {
    setIsTranspiling(true);
    try {
      const result = await transpilePineScript(pineScriptCode);

      if (result.status === 'success' && result.python_code) {
        // Update python code
        setPythonCode(result.python_code);
        onPythonCodeChange?.(result.python_code);

        // Auto-switch to Python tab
        setActiveTab('python');

        // Show success notification
        setNotification({
          isOpen: true,
          type: 'success',
          title: 'Conversion Successful',
          message: 'Python code generated successfully!'
        });
      } else {
        throw new Error('Transpilation failed');
      }
    } catch (error: any) {
      console.error('Error transpiling Pine Script:', error);
      const errorMessage = error.message || 'Failed to generate Python code';
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transpilation Error',
        message: errorMessage
      });
    } finally {
      setIsTranspiling(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 min-h-0">
      <div className="border-b border-gray-700 p-3 sm:p-4 flex-shrink-0 bg-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg sm:text-xl font-bold text-white">Pine Script Editor</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="strategyName" className="text-sm font-medium text-gray-300">Name:</label>
            <input
              id="strategyName"
              type="text"
              value={strategyName}
              onChange={(e) => {
                if (onNameChange) {
                  onNameChange(e.target.value);
                } else {
                  setInternalStrategyName(e.target.value);
                }
              }}
              className="bg-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
            />
          </div>
        </div>

        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex gap-1 px-3">
          <button
            onClick={() => setActiveTab('pine')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'pine'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            Pine Script (Source)
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'python'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            Python Engine (Generated)
            {currentPythonCode && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">✓</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 p-0 min-h-0 relative overflow-hidden">
        {activeTab === 'pine' ? (
          <CodeMirror
            value={pineScriptCode}
            height="100%"
            theme={vscodeDark}
            extensions={[javascript({ jsx: true })]}
            onChange={(value) => {
              setPineScriptCode(value);
              onScriptChange?.(value);
            }}
            className="h-full text-sm"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              history: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: true,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
          />
        ) : (
          <div className="h-full flex flex-col">
            {/* Python Tab Header with Unlock Button */}
            <div className="bg-gray-800 border-b border-gray-700 px-3 py-2 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {isPythonUnlocked ? '🔓 Editing enabled' : '🔒 Read-only (Click unlock to edit)'}
              </span>
              <button
                onClick={() => setIsPythonUnlocked(!isPythonUnlocked)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors"
              >
                {isPythonUnlocked ? (
                  <>
                    <Lock size={12} /> Lock
                  </>
                ) : (
                  <>
                    <Unlock size={12} /> Unlock
                  </>
                )}
              </button>
            </div>

            {/* Python Code Editor */}
            <div className="flex-1">
              {currentPythonCode ? (
                <CodeMirror
                  value={currentPythonCode}
                  height="100%"
                  theme={vscodeDark}
                  extensions={[python()]}
                  onChange={(value) => {
                    if (isPythonUnlocked) {
                      setPythonCode(value);
                      onPythonCodeChange?.(value);
                    }
                  }}
                  editable={isPythonUnlocked}
                  className="h-full text-sm"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    history: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    defaultKeymap: true,
                    searchKeymap: true,
                    historyKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="text-lg mb-2">No Python code generated yet</p>
                    <p className="text-sm">Click "⚡ Generate Engine" to transpile your Pine Script</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
            disabled={isUploading || isTranspiling}
          >
            📁 Upload
          </button>

          <button
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-bold py-2 px-6 rounded flex items-center gap-2 text-sm transition-colors shadow-lg"
            onClick={handleGenerateEngine}
            disabled={isUploading || isTranspiling}
          >
            {isTranspiling ? 'Generating...' : '⚡ Generate Engine'}
          </button>

          <button
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-6 rounded flex items-center gap-2 text-sm transition-colors shadow-lg"
            onClick={handleSaveScript}
            disabled={isUploading || isTranspiling}
          >
            {isUploading ? 'Processing...' : '💾 Save & Compile'}
          </button>
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />

      {/* Transpilation Progress Modal */}
      <TranspilationProgress isOpen={isTranspiling} />
    </div>
  );
};

export default PineScriptPanel;
