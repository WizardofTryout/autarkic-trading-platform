
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Save, X } from 'lucide-react';
import { saveDocument } from '../../services/api';
import { NotificationModal } from '../Common/NotificationModal';

interface DocumentViewerProps {
    initialContent?: string;
    onSaveSuccess?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ initialContent = "", onSaveSuccess }) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [folder, setFolder] = useState('General');
    const [isSaving, setIsSaving] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
    }>({
        isOpen: false,
        type: 'success',
        title: '',
        message: ''
    });

    // Auto-scroll to bottom when content changes
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [initialContent]);

    const handleSave = async () => {
        if (!title.trim()) {
            setNotification({
                isOpen: true,
                type: 'error',
                title: 'Validation Error',
                message: 'Please enter a title for the document.'
            });
            return;
        }

        setIsSaving(true);
        try {
            await saveDocument({
                title,
                content: initialContent,
                folder,
                tags: []
            });
            setIsSaveModalOpen(false);
            setTitle('');

            setNotification({
                isOpen: true,
                type: 'success',
                title: 'Success',
                message: 'Document saved successfully!'
            });

            if (onSaveSuccess) {
                onSaveSuccess();
            }

        } catch (error) {
            console.error("Failed to save document:", error);
            setNotification({
                isOpen: true,
                type: 'error',
                title: 'Save Failed',
                message: 'An error occurred while saving the document. Please try again.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 text-white relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
                <h2 className="text-lg font-semibold">Document Viewer</h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setIsSaveModalOpen(true)}
                        disabled={!initialContent}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium transition-colors"
                    >
                        <Save size={16} />
                        Save
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed">
                {initialContent ? (
                    <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{initialContent}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <p className="text-lg mb-2">No analysis generated yet.</p>
                        <p className="text-sm">Use the Research Agent to generate a report.</p>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Save Modal */}
            {isSaveModalOpen && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-96 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">Save Analysis</h3>
                            <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. BTC Trend Analysis"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase">Folder</label>
                                <input
                                    type="text"
                                    value={folder}
                                    onChange={(e) => setFolder(e.target.value)}
                                    placeholder="e.g. Crypto, Stocks..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsSaveModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Document'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            <NotificationModal
                isOpen={notification.isOpen}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default DocumentViewer;
