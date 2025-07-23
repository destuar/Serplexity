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

const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, index, compact = false }) => (
  <a 
    href={citation.url}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center gap-1 text-xs transition-colors border rounded-md mx-0.5 ${
      compact 
        ? 'px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' 
        : 'px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
    }`}
    title={citation.title}
    onClick={(e) => e.stopPropagation()}
  >
    <ExternalLink className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
    <span className="font-medium">{index + 1}</span>
    <span className={`truncate ${compact ? 'max-w-[60px]' : 'max-w-[80px]'}`}>
      {citation.domain}
    </span>
  </a>
);

export default CitationBadge; 