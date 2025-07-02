import React from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import Card from '../ui/Card';

const AiVisibilitySummaryCard: React.FC = () => {
    const { data, loading } = useDashboard();
    const summary = data?.aiVisibilitySummary || null;

    return (
        <Card className="h-full flex flex-col p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex-shrink-0">AI Visibility Summary</h3>
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="space-y-2">
                        <div className="bg-gray-200 rounded h-4 w-full animate-pulse"></div>
                        <div className="bg-gray-200 rounded h-4 w-5/6 animate-pulse"></div>
                        <div className="bg-gray-200 rounded h-4 w-3/4 animate-pulse"></div>
                    </div>
                ) : summary ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">No summary available yet. A summary will be generated with your next report.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default AiVisibilitySummaryCard;
