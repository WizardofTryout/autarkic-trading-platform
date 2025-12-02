import React, { useState } from 'react';
import { FileText, MessageSquare, Save, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuthStore } from '../../store/authStore';
import { useTradingStore } from '../../store/tradingStore';

interface ResearchPanelProps {
    symbol: string;
    onDiscuss: (context: string) => void;
    onBack: () => void;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({ symbol, onDiscuss, onBack }) => {
    const { currentAnalysis, setCurrentAnalysis } = useTradingStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { token } = useAuthStore();

    const generateAnalysis = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/v1/research/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ symbol, timeframe: '1d' })
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            setCurrentAnalysis(data.content);
        } catch (error) {
            console.error(error);
            alert('Failed to generate analysis. Please check your API Key.');
        } finally {
            setLoading(false);
        }
    };

    const saveDocument = async () => {
        if (!currentAnalysis) return;
        setSaving(true);
        try {
            const response = await fetch('http://localhost:8000/api/v1/research/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: `${symbol} Analysis - ${new Date().toLocaleDateString()}`,
                    content: currentAnalysis,
                    doc_type: 'research_report',
                    tags: [symbol]
                })
            });

            if (!response.ok) throw new Error('Save failed');
            alert('Analysis saved to Documents!');
        } catch (error) {
            console.error(error);
            alert('Failed to save document.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-gray-900 text-white">
            <div className="flex-none p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                        title="Back to Chart"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="text-blue-400" />
                            AI Research Hub
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Daily analysis and insights for <span className="font-bold text-white">{symbol}</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {currentAnalysis && (
                        <>
                            <button
                                onClick={() => onDiscuss(currentAnalysis)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Discuss
                            </button>
                            <button
                                onClick={saveDocument}
                                disabled={saving}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                            </button>
                        </>
                    )}
                    <button
                        onClick={generateAnalysis}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {currentAnalysis ? 'Regenerate' : 'Generate Analysis'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                        <p>Analyzing market structure...</p>
                        <p className="text-xs mt-2">Powered by Gemini AI</p>
                    </div>
                ) : currentAnalysis ? (
                    <div className="prose prose-invert max-w-none pb-20">
                        <ReactMarkdown>{currentAnalysis}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-lg m-4">
                        <FileText className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No analysis generated yet</p>
                        <p className="text-sm">Click "Generate Analysis" to get AI insights for {symbol}.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResearchPanel;
