/**
 * @file FormattedResponseViewer.tsx
 * @description Component for displaying formatted AI responses with syntax highlighting, markdown support, and interactive elements.
 * Handles various response formats including code blocks, lists, tables, and inline formatting.
 *
 * @dependencies
 * - react: For component rendering and state management.
 * - react-syntax-highlighter: For code syntax highlighting.
 * - lucide-react: For icons.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - FormattedResponseViewer: The main formatted response viewer component.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatResponseText, stripBrandTags } from '../../lib/responseFormatter';
import { useCompany } from '../../contexts/CompanyContext';
import { useDashboard } from '../../hooks/useDashboard';

interface FormattedResponseViewerProps {
  text: string;
  className?: string;
  compact?: boolean;
}

/**
 * Production-grade response viewer that handles JSON, markdown, and plain text
 * with proper formatting for AI model responses
 */
const FormattedResponseViewer: React.FC<FormattedResponseViewerProps> = ({ 
  text, 
  className = "",
  compact = false 
}) => {
  const { selectedCompany } = useCompany();
  const { acceptedCompetitors } = useDashboard();
  
  // Process the text through our formatting pipeline
  const processedText = React.useMemo(() => {
    // First strip brand tags
    const cleanText = stripBrandTags(text);
    
    // Then format the text (handles JSON, bullet points, etc.)
    const formattedText = formatResponseText(cleanText);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('FormattedResponseViewer - Original text:', text);
      console.log('FormattedResponseViewer - Processed text:', formattedText);
    }
    
    return formattedText;
  }, [text]);

  // Company highlighting function for ReactMarkdown (user brand + accepted competitors)
  const highlightCompanies = (text: string): React.ReactNode => {
    if (!text) return text;

    // Collect all company names to highlight
    const companiesToHighlight: Array<{name: string, isUserBrand: boolean}> = [];
    
    // Add user's brand
    if (selectedCompany?.name) {
      companiesToHighlight.push({
        name: selectedCompany.name,
        isUserBrand: true
      });
    }
    
    // Add accepted competitors
    if (acceptedCompetitors && acceptedCompetitors.length > 0) {
      acceptedCompetitors.forEach(competitor => {
        companiesToHighlight.push({
          name: competitor.name,
          isUserBrand: false
        });
      });
    }

    if (companiesToHighlight.length === 0) return text;

    // Create a combined regex for all companies (sorted by length descending to match longer names first)
    const sortedCompanies = companiesToHighlight.sort((a, b) => b.name.length - a.name.length);
    const companiesPattern = sortedCompanies.map(comp => 
      comp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    const companiesRegex = new RegExp(`(${companiesPattern})`, 'gi');
    const parts = text.split(companiesRegex);

    return (
      <>
        {parts.map((part, index) => {
          // Check if this part matches any of our companies
          const matchedCompany = companiesToHighlight.find(comp => 
            part.toLowerCase() === comp.name.toLowerCase()
          );
          
          if (matchedCompany) {
            return (
              <span 
                key={index} 
                className={matchedCompany.isUserBrand 
                  ? "bg-blue-100 text-gray-900 px-1 py-0.5 rounded" 
                  : "bg-yellow-100 text-gray-900 px-1 py-0.5 rounded"
                }
              >
                {part}
              </span>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  return (
    <div className={`bg-white rounded-lg px-2 py-3 ${className}`}>
      <div className={`prose prose-sm max-w-none ${compact ? 'prose-p:mb-2' : 'prose-p:mb-4'} prose-headings:text-gray-900 prose-p:text-gray-800 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-semibold prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-pre:border prose-pre:border-gray-200 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-li:text-gray-800`}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // Enhanced paragraph renderer with company highlighting
            p: ({ children }) => (
              <p className="mb-4 leading-relaxed text-gray-800">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </p>
            ),
            
            // Enhanced text renderer with company highlighting
            text: ({ children }) => (
              <>{typeof children === 'string' ? highlightCompanies(children) : children}</>
            ),
            
            // Enhanced strong renderer with company highlighting
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </strong>
            ),
            
            // Enhanced list item renderer with company highlighting
            li: ({ children }) => (
              <li className="text-gray-800 my-1">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </li>
            ),
            
            // Customize code blocks for better appearance
            code: ({ className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              return match ? (
                <pre className="bg-gray-100 rounded-md p-3 overflow-x-auto border border-gray-200 my-4">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              ) : (
                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800" {...props}>
                  {children}
                </code>
              );
            },
            
            // Enhanced blockquote styling
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4">
                {children}
              </blockquote>
            ),
            
            // Enhanced link styling with external indicators
            a: ({ href, children, ...props }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#7762ff] hover:text-[#6650e6] underline font-medium" 
                {...props}
              >
                {children}
              </a>
            ),
            
            // Enhanced unordered list styling - using list-disc for proper markdown lists
            ul: ({ children }) => (
              <ul className="list-disc pl-6 space-y-1 my-4 text-gray-800">
                {children}
              </ul>
            ),
            
            // Enhanced ordered list styling  
            ol: ({ children }) => (
              <ol className="list-decimal pl-6 space-y-1 my-4 text-gray-800">
                {children}
              </ol>
            ),
            
            // Enhanced table styling for proper display
            table: ({ children }) => (
              <div className="overflow-x-auto my-6">
                <table className="min-w-full divide-y divide-gray-300 border border-gray-200 rounded-lg">
                  {children}
                </table>
              </div>
            ),
            
            thead: ({ children }) => (
              <thead className="bg-gray-50">
                {children}
              </thead>
            ),
            
            tbody: ({ children }) => (
              <tbody className="bg-white divide-y divide-gray-200">
                {children}
              </tbody>
            ),
            
            tr: ({ children }) => (
              <tr className="hover:bg-gray-50 transition-colors">
                {children}
              </tr>
            ),
            
            th: ({ children }) => (
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </th>
            ),
            
            td: ({ children }) => (
              <td className="px-4 py-3 text-sm text-gray-800 border-b border-gray-100">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </td>
            ),

            // Enhanced heading styling
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-gray-900 mb-4 mt-6">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-5">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-md font-medium text-gray-900 mb-2 mt-4">
                {typeof children === 'string' ? highlightCompanies(children) : children}
              </h3>
            ),
          }}
        >
          {processedText}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default FormattedResponseViewer; 