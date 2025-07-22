/**
 * @file PromptsPage.tsx
 * @description Prompts management page for viewing and managing prompts/questions.
 * Provides prompt library, ability to add custom prompts, and prompt management features.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../contexts/CompanyContext: For company data.
 * - ../hooks/useDashboard: For dashboard data.
 *
 * @exports
 * - PromptsPage: The main prompts management page component.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, MessageSquare, ListFilter, Plus, Search, Edit2, Trash2, Check, X } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { getPromptsWithResponses, PromptQuestion, getAcceptedCompetitors, CompetitorData } from '../services/companyService';
import { getCompanyLogo } from '../lib/logoService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { useNavigation } from '../hooks/useNavigation';
import { useEmbeddedPage } from '../hooks/useEmbeddedPage';
import ResponsesPage from './ResponsesPage';

// Utility function to format relative time
const formatRelativeTime = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes === 1 ? '' : 's'} ago`;
  if (diffInHours < 24) return `${diffInHours} hr${diffInHours === 1 ? '' : 's'} ago`;
  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
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

// Get company logos for a prompt using the new data structure
const getPromptCompanyLogos = (promptQuestion: PromptQuestion, acceptedCompetitors: unknown): Array<{name: string, logoUrl: string, isOverflow?: boolean, count?: number}> => {
  if (!promptQuestion?.responses || promptQuestion.responses.length === 0) return [];
  
  // Aggregate all brands from all responses for this question
  const allBrands: string[] = [];
  promptQuestion.responses.forEach(response => {
    allBrands.push(...response.brands);
  });
  
  return getCompetitorLogos(allBrands, acceptedCompetitors, 4);
};

interface PromptItem {
  id: string;
  question: string;
  type?: string;
  isCustom?: boolean;
  usageCount?: number;
  lastUsed?: string;
  status?: 'active' | 'inactive' | 'suggested';
}

const PromptListItem: React.FC<{ 
  prompt: PromptItem; 
  index: number;
  promptQuestion?: PromptQuestion;
  acceptedCompetitors?: unknown;
  onEdit?: (prompt: PromptItem) => void;
  onDelete?: (prompt: PromptItem) => void;
  onClick?: (prompt: PromptItem) => void;
  onStatusChange?: (prompt: PromptItem, newStatus: 'active' | 'inactive' | 'suggested') => void;
}> = ({ prompt, index, promptQuestion, acceptedCompetitors, onEdit, onDelete, onClick, onStatusChange }) => {
  const companyLogos = promptQuestion ? getPromptCompanyLogos(promptQuestion, acceptedCompetitors || []) : [];

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer mb-3" onClick={() => onClick?.(prompt)}>
      <div className="px-4 py-3">
        <div className="flex items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Number */}
            <div className="flex-shrink-0 w-6 flex items-center justify-center text-xs font-medium text-gray-500">
              {index + 1}
            </div>
            
            {/* Question */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 font-medium leading-relaxed">
                {prompt.question}
              </p>
            </div>
          </div>
          
          {/* Company Logos */}
          <div className="w-32 flex justify-start">
            {companyLogos.length > 0 && (
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
            )}
          </div>
          
          {/* Created Time */}
          <div className="flex-shrink-0 mr-8">
            <div className="text-xs text-gray-500">
              {formatRelativeTime(prompt.lastUsed)}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Status change buttons */}
            {prompt.status === 'suggested' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(prompt, 'active');
                }}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Mark as Active"
              >
                <Check size={16} />
              </button>
            )}
            {prompt.status === 'active' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(prompt, 'inactive');
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Mark as Inactive"
              >
                <X size={16} />
              </button>
            )}
            {prompt.status === 'inactive' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(prompt, 'active');
                }}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Mark as Active"
              >
                <Check size={16} />
              </button>
            )}
            
            {/* Edit/Delete for custom prompts */}
            {prompt.isCustom && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(prompt);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit prompt"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(prompt);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete prompt"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


const AddPromptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (prompt: { question: string; type: string }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [question, setQuestion] = useState('');
  const [type, setType] = useState('research');

  if (!isOpen) return null;

  const handleSave = () => {
    if (question.trim()) {
      onSave({ question: question.trim(), type });
      setQuestion('');
      setType('research');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-md mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Prompt</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question/Prompt
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question or prompt..."
                className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:border-transparent"
              >
                <option value="research">Research</option>
                <option value="comparison">Comparison</option>
                <option value="specific">Specific</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!question.trim()}
              className="px-4 py-2 bg-[#7762ff] text-white rounded-md shadow-sm border border-[#7762ff] hover:bg-[#6650e6] hover:border-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PromptsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data: dashboardData, loading: dashboardLoading, hasReport } = useDashboard();
  const { setBreadcrumbs, registerEmbeddedPageCloser, unregisterEmbeddedPageCloser } = useNavigation();
  const { embeddedPage, openEmbeddedPage, closeEmbeddedPage, isEmbedded } = useEmbeddedPage('Prompts');
  
  // Local state
  const [promptQuestions, setPromptQuestions] = useState<PromptQuestion[]>([]);
  const [customPrompts, setCustomPrompts] = useState<PromptItem[]>([]);
  const [acceptedCompetitors, setAcceptedCompetitors] = useState<CompetitorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);

  // Show limit dropdown (10, 20, 50, all)
  const [showLimit] = useState<'10' | '20' | '50' | 'all'>('20');

  // Status filter and overrides
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'suggested'>('active');
  const [promptStatusOverrides, setPromptStatusOverrides] = useState<Record<string, 'active' | 'inactive' | 'suggested'>>({});


  // Report generation logic
  const { 
    isGenerating, 
    generationStatus, 
    progress, 
    generateReport, 
    isButtonDisabled, 
    generationState, 
  } = useReportGeneration(selectedCompany);

  // Set breadcrumb for this page
  useEffect(() => {
    if (!isEmbedded) {
      setBreadcrumbs([{ label: 'Prompts' }]);
    }
  }, [isEmbedded, setBreadcrumbs]);

  // Register/unregister embedded page closer
  useEffect(() => {
    registerEmbeddedPageCloser('/prompts', closeEmbeddedPage);
    return () => unregisterEmbeddedPageCloser('/prompts');
  }, [registerEmbeddedPageCloser, unregisterEmbeddedPageCloser, closeEmbeddedPage]);

  // Fetch accepted competitors
  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchCompetitors = async () => {
        try {
          const competitors = await getAcceptedCompetitors(selectedCompany.id);
          setAcceptedCompetitors(competitors.competitors || []);
        } catch {
          // Error handling in place
        }
      };
      fetchCompetitors();
    }
  }, [selectedCompany?.id]);

  // Fetch prompts with responses
  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchPrompts = async () => {
        try {
          setIsLoading(true);
          const data = await getPromptsWithResponses(selectedCompany.id);
          setPromptQuestions(data.questions || []);
          setError(null);
        } catch (err) {
          console.error('Error fetching prompts:', err);
          setError('Failed to load prompts data');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchPrompts();
    }
  }, [selectedCompany?.id]);

  // Transform prompt questions to prompt format
  const allPrompts = useMemo(() => {
    // Convert prompt questions to prompt items with status logic
    const generatedPrompts: PromptItem[] = promptQuestions.map((q, index) => {
      // Check if we have a status override for this prompt
      const overrideStatus = promptStatusOverrides[q.id];
      
      let status: 'active' | 'inactive' | 'suggested';
      if (overrideStatus) {
        status = overrideStatus;
      } else {
        // Default status logic
        if (index < 5) {
          status = q.responses.length > 0 ? 'active' : 'inactive';
        } else {
          status = 'suggested';
        }
      }

      return {
        id: q.id,
        question: q.question,
        type: q.type || 'research',
        isCustom: false,
        usageCount: q.responses.length,
        lastUsed: q.responses[0]?.createdAt || new Date().toISOString(),
        status: status
      };
    });

    const combined = [...generatedPrompts, ...customPrompts];

    // Apply search filter
    let filtered = searchTerm
      ? combined.filter(p => 
          p.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.type && p.type.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : combined;

    // Apply status filter
    filtered = filtered.filter(p => p.status === statusFilter);

    // Apply limit if needed
    return showLimit === 'all' ? filtered : filtered.slice(0, parseInt(showLimit, 10));
  }, [promptQuestions, customPrompts, promptStatusOverrides, searchTerm, showLimit, statusFilter]);

  // Create a mapping of prompt IDs to prompt questions for logo extraction
  const promptToQuestionMap = useMemo(() => {
    const map = new Map<string, PromptQuestion>();
    promptQuestions.forEach(q => {
      map.set(q.id, q);
    });
    return map;
  }, [promptQuestions]);

  const handleRefresh = async () => {
    if (selectedCompany?.id) {
      try {
        setIsLoading(true);
        const data = await getPromptsWithResponses(selectedCompany.id);
        setPromptQuestions(data.questions || []);
        setError(null);
      } catch (err) {
        console.error('Error refreshing prompts:', err);
        setError('Failed to load prompts data');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddPrompt = (promptData: { question: string; type: string }) => {
    const newPrompt: PromptItem = {
      id: `custom_${Date.now()}`,
      question: promptData.question,
      type: promptData.type,
      isCustom: true,
      usageCount: 0,
      status: 'suggested' // New custom prompts start as suggested
    };
    setCustomPrompts(prev => [newPrompt, ...prev]);
  };

  const handleEditPrompt = (prompt: PromptItem) => {
    // Edit functionality pending UX design approval
    console.log('Edit prompt:', prompt);
  };

  const handleDeletePrompt = (prompt: PromptItem) => {
    if (prompt.isCustom) {
      setCustomPrompts(prev => prev.filter(p => p.id !== prompt.id));
    }
  };

  const handleStatusChange = (prompt: PromptItem, newStatus: 'active' | 'inactive' | 'suggested') => {
    if (prompt.isCustom) {
      // Update custom prompts
      setCustomPrompts(prev => 
        prev.map(p => p.id === prompt.id ? { ...p, status: newStatus } : p)
      );
    } else {
      // For generated prompts, store the status override
      setPromptStatusOverrides(prev => ({
        ...prev,
        [prompt.id]: newStatus
      }));
    }
  };

  const handlePromptClick = (prompt: PromptItem) => {
    setSelectedPrompt(prompt);
    openEmbeddedPage('responses', 'Responses');
  };


  // Render embedded responses view
  if (embeddedPage === 'responses' && selectedPrompt) {
    return <ResponsesPage prompt={selectedPrompt} />;
  }

  return (
    <div className="flex flex-col">
      {dashboardLoading || hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          progress={progress}
          isButtonDisabled={isButtonDisabled}
          generationState={generationState}
        />
      ) : (
        <>

          {/* Filter, Search and Add Bar */}
          <div className="flex-shrink-0 flex gap-4 mb-4 items-center">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suggested', label: 'Suggested' },
              ]}
              onChange={(value) => setStatusFilter(value as typeof statusFilter)}
              icon={ListFilter}
              disabled={dashboardLoading || isLoading}
            />
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg shadow-sm border border-[#7762ff] hover:bg-[#6650e6] hover:border-[#6650e6] transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Add Prompt
            </button>
          </div>

          {/* Content Area */}
          {!dashboardData || (isLoading && promptQuestions.length === 0) ? (
            <BlankLoadingState message="Loading prompts..." />
          ) : error ? (
            <div className="flex-1 min-h-0 p-1 flex items-center justify-center">
              <div className="text-center p-8">
                <p className="text-xl font-semibold text-gray-500">Failed to load data. Try refreshing the page.</p>
                <button
                  onClick={() => {
                    setPromptQuestions([]);
                    handleRefresh();
                  }}
                  className="mt-4 px-4 py-2 bg-[#7762ff] text-white rounded-md shadow-sm border border-[#7762ff] hover:bg-[#6a55e3] hover:border-[#6a55e3] transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 p-1">
              <div className="h-full w-full">
                <div className="h-full overflow-y-auto p-2">
                  {allPrompts.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">
                          {searchTerm ? 'No prompts found matching your search' : 'No prompts generated yet'}
                        </p>
                        <p className="text-gray-400 text-sm mt-2">
                          {searchTerm ? 'Try adjusting your search terms' : 'Generated prompts will appear here after creating a report'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Floating Headers */}
                      <div className="px-4 mb-3">
                        <div className="flex items-center">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-6 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">#</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prompt</span>
                            </div>
                          </div>
                          
                          {/* Company Logos Header - aligned with content */}
                          <div className="w-32 flex justify-start mr-6">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">MENTIONS</span>
                          </div>
                          
                          {/* Created Time Header - aligned with content */}
                          <div className="flex-shrink-0 mr-8">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CREATED</span>
                          </div>
                          
                          {/* Actions placeholder */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="w-20"></div>
                          </div>
                        </div>
                      </div>
                      
                      {allPrompts.map((prompt, index) => (
                        <PromptListItem
                          key={prompt.id}
                          prompt={prompt}
                          index={index}
                          promptQuestion={promptToQuestionMap.get(prompt.id)}
                          acceptedCompetitors={acceptedCompetitors}
                          onEdit={handleEditPrompt}
                          onDelete={handleDeletePrompt}
                          onClick={handlePromptClick}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Prompt Modal */}
      <AddPromptModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddPrompt}
      />
    </div>
  );
};

export default PromptsPage;