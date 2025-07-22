/**
 * @file ResponsesPage.tsx
 * @description Responses page for viewing AI model responses to a specific prompt.
 * Shows all model responses with brand mention images, similar to PromptsPage layout.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../contexts/CompanyContext: For company data.
 * - ../services/companyService: For fetching responses.
 * - ../lib/logoService: For company logos.
 *
 * @exports
 * - ResponsesPage: The responses page component for a specific prompt.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Calendar, Sparkles, Search } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { getPromptsWithResponses, PromptQuestion, getAcceptedCompetitors, CompetitorData, getCitations, CitationData } from '../services/companyService';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import FormattedResponseViewer from '../components/ui/FormattedResponseViewer';
import { getModelDisplayName, MODEL_CONFIGS } from '../types/dashboard';
import { getCompanyLogo } from '../lib/logoService';
import FilterDropdown from '../components/dashboard/FilterDropdown';

interface ResponsesPageProps {
  prompt: {
    id: string;
    question: string;
    type?: string;
    isCustom?: boolean;
    usageCount?: number;
    lastUsed?: string;
    status?: 'active' | 'inactive' | 'suggested';
  };
}

// Get citation icons with overflow handling - cross-references citation IDs with database
const getCitationIcons = (citationIds: string[], allCitations: CitationData[], maxDisplay: number = 4): Array<{name: string, url: string, domain: string, isOverflow?: boolean, count?: number}> => {
  if (!citationIds || citationIds.length === 0 || !allCitations || allCitations.length === 0) {
    return [];
  }
  
  // Cross-reference citation IDs with actual citation data
  const matchedCitations = citationIds
    .map(citationId => allCitations.find(citation => citation.id === citationId))
    .filter(citation => citation !== undefined) as CitationData[];
  
  const uniqueCitations = [...new Map(matchedCitations.map(citation => [citation.id, citation])).values()];
  const citationItems = uniqueCitations.map(citation => ({
    name: citation.title || citation.domain,
    url: citation.url,
    domain: citation.domain
  }));
  
  if (citationItems.length <= maxDisplay) {
    return citationItems;
  }
  
  const displayed = citationItems.slice(0, maxDisplay);
  const remaining = citationItems.length - maxDisplay;
  
  return [
    ...displayed,
    {
      name: `+${remaining} more`,
      url: '',
      domain: '',
      isOverflow: true,
      count: remaining
    }
  ];
};

// Get competitor logos with overflow handling - only shows accepted competitors
const getCompetitorLogos = (brands: string[], acceptedCompetitors: unknown, maxDisplay: number = 4): Array<{name: string, logoUrl: string, isOverflow?: boolean, count?: number}> => {
  // Handle case where acceptedCompetitors might be an object with competitors property
  const competitorsList = Array.isArray(acceptedCompetitors) 
    ? acceptedCompetitors 
    : (acceptedCompetitors && typeof acceptedCompetitors === 'object' && 'competitors' in acceptedCompetitors) 
      ? (acceptedCompetitors as { competitors: unknown }).competitors 
      : null;
  
  if (!Array.isArray(competitorsList) || competitorsList.length === 0 || !brands || brands.length === 0) {
    return [];
  }
  
  // Filter brands to only include accepted competitors
  const filteredBrands = brands.filter(brand => 
    competitorsList.some(comp => 
      comp.name.toLowerCase() === brand.toLowerCase()
    )
  );
  
  const uniqueBrands = [...new Set(filteredBrands)];
  const competitors = uniqueBrands.map(brand => {
    const competitor = competitorsList.find(comp => 
      comp.name.toLowerCase() === brand.toLowerCase()
    );
    const websiteUrl = competitor?.website || `${brand.toLowerCase().replace(/\s+/g, '')}.com`;
    const logoResult = getCompanyLogo(websiteUrl);
    return {
      name: brand,
      logoUrl: logoResult.url
    };
  });
  
  if (competitors.length <= maxDisplay) {
    return competitors;
  }
  
  const displayed = competitors.slice(0, maxDisplay);
  const remaining = competitors.length - maxDisplay;
  
  return [
    ...displayed,
    {
      name: `+${remaining} more`,
      logoUrl: '',
      isOverflow: true,
      count: remaining
    }
  ];
};


interface ResponseItemData {
  id: string;
  model: string;
  response: string;
  position: number | null;
  brands: string[];
  citations: string[];
  createdAt: string;
}

const ResponseListItem: React.FC<{ 
  response: ResponseItemData; 
  index: number;
  acceptedCompetitors: unknown;
  citations: CitationData[];
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ response, index: _index, acceptedCompetitors, citations, isExpanded, onToggle }) => {
  const companyLogos = getCompetitorLogos(response.brands || [], acceptedCompetitors || [], 4);
  const citationIcons = getCitationIcons(response.citations || [], citations || [], 4);
  const modelConfig = MODEL_CONFIGS[response.model];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-3 ml-12" onClick={onToggle}>
      <div className="px-4 py-3">
        <div className="flex items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Model */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {modelConfig?.logoUrl && (
                <img 
                  src={modelConfig.logoUrl} 
                  alt={getModelDisplayName(response.model)} 
                  className="h-5 w-5 rounded object-contain flex-shrink-0"
                />
              )}
              <span className="text-sm text-gray-900 font-medium">
                {getModelDisplayName(response.model)}
              </span>
            </div>
          </div>
          
          {/* Company Logos */}
          <div className="w-32 flex justify-start">
            {companyLogos.length > 0 ? (
              <div className="flex items-center gap-1">
                {companyLogos.map((competitor, logoIndex) => (
                  competitor.isOverflow ? (
                    <div
                      key={`overflow-${logoIndex}`}
                      className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shadow-md"
                      title={competitor.name}
                      style={{
                        marginLeft: logoIndex > 0 ? '-14px' : '0',
                        zIndex: companyLogos.length - logoIndex
                      }}
                    >
                      +{competitor.count}
                    </div>
                  ) : (
                    <div
                      key={`${competitor.name}-${logoIndex}`}
                      className="w-6 h-6 rounded bg-white flex items-center justify-center overflow-hidden shadow-md"
                      title={competitor.name}
                      style={{
                        marginLeft: logoIndex > 0 ? '-14px' : '0',
                        zIndex: companyLogos.length - logoIndex
                      }}
                    >
                      <img
                        src={competitor.logoUrl}
                        alt={competitor.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = competitor.name.charAt(0).toUpperCase();
                            parent.classList.add('text-xs', 'font-medium', 'text-gray-600', 'bg-gray-100');
                          }
                        }}
                      />
                    </div>
                  )
                ))}
              </div>
            ) : null}
          </div>
          
          {/* Citations */}
          <div className="w-32 flex justify-start">
            {citationIcons.length > 0 && (
              <div className="flex items-center gap-1">
                {citationIcons.map((citation, citationIndex) => (
                  citation.isOverflow ? (
                    <div
                      key={`citation-overflow-${citationIndex}`}
                      className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shadow-md"
                      title={citation.name}
                      style={{
                        marginLeft: citationIndex > 0 ? '-14px' : '0',
                        zIndex: citationIcons.length - citationIndex
                      }}
                    >
                      +{citation.count}
                    </div>
                  ) : (
                    <a
                      key={`citation-${citation.name}-${citationIndex}`}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-xs font-medium text-blue-600 shadow-md hover:bg-blue-100 transition-colors"
                      title={`${citation.name} - ${citation.domain}`}
                      style={{
                        marginLeft: citationIndex > 0 ? '-14px' : '0',
                        zIndex: citationIcons.length - citationIndex
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗
                    </a>
                  )
                ))}
              </div>
            )}
          </div>
          
          {/* Expand Toggle */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isExpanded ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded Response Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
              Response
            </h4>
          </div>
          <div className="text-sm">
            <FormattedResponseViewer text={response.response} />
          </div>
        </div>
      )}
    </div>
  );
};

const ResponsesPage: React.FC<ResponsesPageProps> = ({ prompt }) => {
  const { selectedCompany } = useCompany();
  
  // Local state
  const [responses, setResponses] = useState<ResponseItemData[]>([]);
  const [acceptedCompetitors, setAcceptedCompetitors] = useState<CompetitorData[]>([]);
  const [citations, setCitations] = useState<CitationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch accepted competitors and citations
  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchCompetitorsAndCitations = async () => {
        try {
          const [competitorsData, citationsData] = await Promise.all([
            getAcceptedCompetitors(selectedCompany.id),
            getCitations(selectedCompany.id)
          ]);
          setAcceptedCompetitors(competitorsData.competitors || []);
          setCitations(citationsData.citations || []);
        } catch (err) {
          console.error('Error fetching competitors and citations:', err);
        }
      };
      fetchCompetitorsAndCitations();
    }
  }, [selectedCompany?.id]);

  // Fetch responses for this specific prompt
  useEffect(() => {
    if (selectedCompany?.id && prompt?.id) {
      const fetchResponses = async () => {
        try {
          setIsLoading(true);
          const data = await getPromptsWithResponses(selectedCompany.id);
          
          // Find the specific prompt question
          const promptQuestion = data.questions?.find((q: PromptQuestion) => q.id === prompt.id);
          
          if (promptQuestion && promptQuestion.responses) {
            // Transform responses to the format we need
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedResponses: ResponseItemData[] = promptQuestion.responses.map((resp: any, _index: number) => {
              return {
                id: `${resp.model}-${_index}`,
                model: resp.model,
                response: resp.response,
                position: resp.position,
                brands: resp.brands || [],
                citations: resp.citations || [],
                createdAt: resp.createdAt || new Date().toISOString()
              };
            });
            
            // Sort by position (lower is better), null positions go to end
            transformedResponses.sort((a, b) => {
              if (a.position === null && b.position === null) return 0;
              if (a.position === null) return 1;
              if (b.position === null) return -1;
              return a.position - b.position;
            });
            
            setResponses(transformedResponses);
          } else {
            setResponses([]);
          }
          setError(null);
        } catch (err) {
          console.error('Error fetching responses:', err);
          setError('Failed to load response data');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchResponses();
    }
  }, [selectedCompany?.id, prompt?.id]);

  const toggleExpanded = (responseId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };

  // Utility function to format date and time as key for grouping
  const getDateTimeKey = (dateString: string): string => {
    const date = new Date(dateString);
    // Group by date + hour + minute for multiple reports per day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}-${minute}`;
  };

  // Utility function to format date for display
  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Utility function to format time for display
  const formatTimeDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Filter and group responses by date
  const { filteredResponses, responsesByDate } = useMemo(() => {
    let filtered = [...responses];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(response => {
        // Search in response text and model name
        const basicMatch = response.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
          getModelDisplayName(response.model).toLowerCase().includes(searchTerm.toLowerCase()) ||
          response.brands.some(brand => brand.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Search in citation data
        const citationMatch = response.citations.some(citationId => {
          const citation = citations.find(c => c.id === citationId);
          return citation && (
            citation.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
            citation.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (citation.title && citation.title.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        });
        
        return basicMatch || citationMatch;
      });
    }

    // Apply model filter
    if (modelFilter !== 'all') {
      filtered = filtered.filter(response => response.model === modelFilter);
    }

    // Apply time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (timeFilter) {
        case '24h':
          cutoff.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoff.setDate(now.getDate() - 30);
          break;
        default:
          break;
      }
      
      if (timeFilter !== 'all') {
        filtered = filtered.filter(response => 
          new Date(response.createdAt) >= cutoff
        );
      }
    }

    // Group responses by date and time
    const grouped = filtered.reduce((acc, response) => {
      const dateTimeKey = getDateTimeKey(response.createdAt);
      if (!acc[dateTimeKey]) {
        acc[dateTimeKey] = [];
      }
      acc[dateTimeKey].push(response);
      return acc;
    }, {} as Record<string, ResponseItemData[]>);

    // Sort date-time groups (most recent first) and sort responses within each group
    const sortedDateTimeKeys = Object.keys(grouped).sort((a, b) => {
      // Convert keys back to dates for proper chronological sorting
      const dateA = grouped[a][0]?.createdAt;
      const dateB = grouped[b][0]?.createdAt;
      return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
    });

    const sortedGrouped = sortedDateTimeKeys.reduce((acc, dateTimeKey) => {
      // Sort responses within each date-time group by position (lower is better), null positions go to end
      acc[dateTimeKey] = grouped[dateTimeKey].sort((a, b) => {
        if (a.position === null && b.position === null) return 0;
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position;
      });
      return acc;
    }, {} as Record<string, ResponseItemData[]>);

    return {
      filteredResponses: filtered,
      responsesByDate: sortedGrouped
    };
  }, [responses, timeFilter, modelFilter, searchTerm, citations]);

  // Get unique models for filter dropdown
  const modelFilterOptions = useMemo(() => {
    const uniqueModels = [...new Set(responses.map(r => r.model))];
    const baseOptions = [{ value: 'all', label: 'All Models' }];
    
    const modelOptions = uniqueModels.map(model => {
      const modelConfig = MODEL_CONFIGS[model];
      return {
        value: model,
        label: getModelDisplayName(model),
        logoUrl: modelConfig?.logoUrl
      };
    });
    
    return [...baseOptions, ...modelOptions];
  }, [responses]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex gap-4 items-center">
        <FilterDropdown
          label="Time"
          value={timeFilter}
          options={[
            { value: 'all', label: 'All Time' },
            { value: '24h', label: 'Last 24 Hours' },
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' },
          ]}
          onChange={setTimeFilter}
          icon={Calendar}
          disabled={isLoading}
        />
        <FilterDropdown
          label="Model"
          value={modelFilter}
          options={modelFilterOptions}
          onChange={setModelFilter}
          icon={modelFilter === 'all' ? Sparkles : undefined}
          disabled={isLoading}
        />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-80 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Prompt and Responses Container */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        {/* Prompt Container */}
        <div className="mb-4 relative">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 ml-4 max-w-4xl">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                {/* Question */}
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm text-gray-900 font-medium leading-relaxed truncate">
                    {prompt.question}
                  </p>
                </div>
                
                {/* Response Count */}
                <div className="flex-shrink-0">
                  <div className="text-xs text-gray-500">
                    {filteredResponses.length} response{filteredResponses.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <BlankLoadingState message="Loading responses..." />
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center p-8">
              <p className="text-xl font-semibold text-gray-500">Failed to load response data</p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {Object.keys(responsesByDate).length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No responses found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    This prompt may not have generated any model responses yet
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(responsesByDate).map(([dateKey, dateResponses]) => {
                  const firstResponse = dateResponses[0];
                  if (!firstResponse) return null;
                  
                  return (
                    <div key={dateKey} className="space-y-3">
                      {/* Date and Mentions Header for this date group */}
                      <div className="ml-6">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-600 font-medium">
                            {formatDateDisplay(firstResponse.createdAt)} at {formatTimeDisplay(firstResponse.createdAt)}
                          </div>
                          
                          <div className="flex-1"></div>
                          
                          <div className="w-32 flex justify-start mr-6">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">MENTIONS</span>
                          </div>
                          
                          <div className="w-32 flex justify-start mr-6">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CITATIONS</span>
                          </div>
                          
                          <div className="w-5"></div>
                        </div>
                      </div>

                      {/* Responses for this date */}
                      <div className="space-y-3">
                        {dateResponses.map((response, index) => (
                          <ResponseListItem
                            key={response.id}
                            response={response}
                            index={index}
                            acceptedCompetitors={acceptedCompetitors}
                            citations={citations}
                            isExpanded={expandedItems.has(response.id)}
                            onToggle={() => toggleExpanded(response.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
  };

export default ResponsesPage;