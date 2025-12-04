

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface DocumentViewerProps {
    initialContent?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ initialContent }) => {
    const [content, setContent] = useState<string>('');
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialContent) {
            setContent(initialContent);
        }
    }, [initialContent]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [content]);

    return (
        <div className="flex flex-col h-full bg-gray-950 text-gray-300">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
                <h2 className="text-sm font-bold text-white">Document Viewer</h2>
                {/* TODO: Add Save Button here later */}
            </div>
            <div className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none">
                {content ? (
                    <ReactMarkdown>{content}</ReactMarkdown>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <p>No analysis generated yet.</p>
                        <p className="text-sm">Use the Research Agent to generate a report.</p>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default DocumentViewer;
