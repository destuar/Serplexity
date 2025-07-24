import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface Citation {
  url: string;
  title: string;
  domain: string;
}

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  compact?: boolean;
}

const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, index, compact = false }) => {
  const [imageError, setImageError] = useState(false);
  
  // Get favicon URL from domain
  const getFaviconUrl = (domain: string): string => {
    try {
      // Try multiple favicon sources
      return `https://www.google.com/s2/favicons?sz=16&domain=${domain}`;
    } catch {
      return '';
    }
  };

  // Remove www. prefix from domain for display
  const cleanDomain = (domain: string): string => {
    return domain.replace(/^www\./, '');
  };

  // Truncate title to reasonable length
  const truncateTitle = (title: string, maxLength: number): string => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  const faviconUrl = getFaviconUrl(citation.domain);
  const displayDomain = cleanDomain(citation.domain);
  const displayTitle = compact 
    ? truncateTitle(citation.title, 20) 
    : truncateTitle(citation.title, 30);

  return (
    <a 
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 transition-all duration-200 border rounded-md mx-0.5 hover:shadow-sm align-baseline ${
        compact 
          ? 'px-1 py-0.5 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-xs' 
          : 'px-2 py-1 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-sm'
      }`}
      style={{ lineHeight: '1.2em', height: compact ? '1.6em' : '1.8em' }}
      title={`${citation.title} - ${citation.domain}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Website favicon */}
      <div className={`flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'} rounded-sm overflow-hidden bg-gray-100 flex items-center justify-center`}>
        {!imageError && faviconUrl ? (
          <img
            src={faviconUrl}
            alt={`${citation.domain} favicon`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-blue-100 flex items-center justify-center">
            <span className={`font-bold text-blue-600 ${compact ? 'text-xs' : 'text-xs'}`}>
              {displayDomain.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Citation content - single line */}
      <span className={`font-medium text-gray-700 truncate ${compact ? 'text-xs max-w-24' : 'text-sm max-w-32'}`}>
        {displayDomain}
      </span>

      {/* External link icon */}
      <ExternalLink className={`flex-shrink-0 text-gray-400 ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
    </a>
  );
};

export default CitationBadge; 