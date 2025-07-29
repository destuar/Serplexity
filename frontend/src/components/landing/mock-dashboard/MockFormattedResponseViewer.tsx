/**
 * @file MockFormattedResponseViewer.tsx
 * @description Mock version of FormattedResponseViewer for use in mock dashboard components.
 * This version doesn't require the DashboardProvider context and provides basic formatting.
 */
import React from 'react';

interface MockFormattedResponseViewerProps {
  text: string;
  compact?: boolean;
  className?: string;
}

const MockFormattedResponseViewer: React.FC<MockFormattedResponseViewerProps> = ({ 
  text, 
  compact = false,
  className = ""
}) => {
  // Simple text processing without context dependencies
  const processedText = React.useMemo(() => {
    // Basic formatting for mock display
    let formatted = text;
    
    // Convert **bold** to actual bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to actual italic
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Simple brand highlighting (for demo purposes)
    formatted = formatted.replace(/Serplexity/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded">Serplexity</span>');
    formatted = formatted.replace(/Athena/g, '<span class="bg-purple-100 text-purple-800 px-1 rounded">Athena</span>');
    formatted = formatted.replace(/Writesonic/g, '<span class="bg-green-100 text-green-800 px-1 rounded">Writesonic</span>');
    formatted = formatted.replace(/BrightEdge/g, '<span class="bg-orange-100 text-orange-800 px-1 rounded">BrightEdge</span>');
    formatted = formatted.replace(/Semrush/g, '<span class="bg-red-100 text-red-800 px-1 rounded">Semrush</span>');
    
    return formatted;
  }, [text]);

  return (
    <div className={`text-sm ${compact ? 'text-xs' : ''} ${className}`}>
      <div 
        dangerouslySetInnerHTML={{ __html: processedText }}
        className="prose prose-sm max-w-none"
      />
    </div>
  );
};

export default MockFormattedResponseViewer;