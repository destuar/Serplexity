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
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RefreshCw, ListFilter, Search, Trash2, Check, X, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/apiClient';
import { getPromptsWithResponses, PromptQuestion, getAcceptedCompetitors, CompetitorData, updateQuestionStatus, addQuestion, deleteQuestion } from '../services/companyService';
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
  if (!dateString || dateString === 'Unknown') return 'Unknown';
  
  const now = new Date();
  const date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) return 'Unknown';
  
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
}> = ({ prompt, index, promptQuestion, acceptedCompetitors, onEdit: _onEdit, onDelete, onClick, onStatusChange }) => {
  const companyLogos = promptQuestion ? getPromptCompanyLogos(promptQuestion, acceptedCompetitors || []) : [];

  // Calculate total citations from all responses (using brands as proxy for citations)
  const totalCitations = promptQuestion ? 
    promptQuestion.responses.reduce((total, response) => total + (response.brands?.length || 0), 0) : 0;

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all cursor-pointer mb-3" onClick={() => onClick?.(prompt)}>
      <div className="px-4 py-3">
        <div className="grid grid-cols-[auto_1fr_8rem_6rem_6rem_5rem] gap-3 items-center">
          {/* Number */}
          <div className="text-xs font-medium text-gray-500">
            {index + 1}
          </div>
          
          {/* Question */}
          <div className="min-w-0">
            <p className="text-sm text-gray-900 font-medium leading-relaxed truncate">
              {prompt.question}
            </p>
          </div>
          
          {/* Mentions (Company Logos) */}
          <div className="pl-6">
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
          
          {/* Citations */}
          <div className="text-xs text-gray-500 pl-6">
            {totalCitations > 0 ? totalCitations : '-'}
          </div>
          
          {/* Created Time */}
          <div className="text-xs text-gray-500 pl-6">
            {formatRelativeTime(prompt.lastUsed)}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 justify-end">
            {/* Status change buttons */}
            {prompt.status === 'suggested' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(prompt, 'active');
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                title="Mark as Active"
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
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
                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                title="Mark as Inactive"
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
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
                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                title="Mark as Active"
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <Check size={16} />
              </button>
            )}
            
            {/* Delete button for all prompts when inactive */}
            {prompt.status === 'inactive' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(prompt);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                title="Delete prompt"
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


const AddPromptInline: React.FC<{
  onSave: (prompt: { question: string }) => void;
  onCancel: () => void;
  canModifyPrompts: boolean;
  isAdmin: boolean;
}> = ({ onSave, onCancel, canModifyPrompts, isAdmin }) => {
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Count words in the question
  const wordCount = question.trim() ? question.trim().split(/\s+/).length : 0;
  const isOverLimit = wordCount > 20;

  const handleSave = async () => {
    if (!question.trim() || isOverLimit || isSubmitting) return;

    // Check if user has permission to add prompts
    if (!canModifyPrompts && !isAdmin) {
      alert('Adding custom prompts requires a subscription. Please upgrade your plan to add custom prompts.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({ question: question.trim() });
      setQuestion('');
      onCancel(); // Hide the input after saving
    } catch (error) {
      console.error('Failed to add prompt:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all mb-3">
      <div className="px-4 py-3">
        <div className="grid grid-cols-[auto_1fr_8rem_6rem_6rem_5rem] gap-3 items-center">
          {/* Number placeholder */}
          <div className="text-xs font-medium text-gray-500">
            1
          </div>
          
          {/* Question Input */}
          <div className="min-w-0 flex items-center">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your custom prompt here..."
              className="w-full px-0 py-0 bg-transparent border-none focus:outline-none resize-none text-sm text-gray-900 font-medium leading-relaxed placeholder:text-gray-500"
              rows={1}
              style={{
                minHeight: '1.25rem',
                height: 'auto',
                overflow: 'hidden'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
              autoFocus
            />
          </div>
          
          {/* Empty space for Mentions */}
          <div className="pl-6"></div>
          
          {/* Empty space for Citations */}
          <div className="pl-6"></div>
          
          {/* Empty space for Created */}
          <div className="pl-6"></div>
          
          {/* Actions - Check and X buttons */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleSave}
              disabled={!question.trim() || isOverLimit || isSubmitting}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-800 hover:text-gray-900 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add prompt"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check size={16} />
              )}
            </button>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
              title="Cancel"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
              <Trash2 size={16} />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Local state
  const [promptQuestions, setPromptQuestions] = useState<PromptQuestion[]>([]);
  const [acceptedCompetitors, setAcceptedCompetitors] = useState<CompetitorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [canModifyPrompts, setCanModifyPrompts] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
      setBreadcrumbs([
        { label: 'AI Performance' },
        { label: 'Prompts' }
      ]);
    }
  }, [isEmbedded, setBreadcrumbs]);

  // Fetch trial status to check if user can modify prompts
  useEffect(() => {
    const fetchTrialStatus = async () => {
      if (!user) return;
      
      try {
        const response = await apiClient.get('/users/me/trial-status');
        const { canModifyPrompts: canModify, isAdmin: adminStatus } = response.data;
        setCanModifyPrompts(canModify || false);
        setIsAdmin(adminStatus || false);
      } catch (error) {
        console.error('Failed to fetch trial status:', error);
        setCanModifyPrompts(false);
        setIsAdmin(false);
      }
    };

    fetchTrialStatus();
  }, [user]);

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
  const fetchPrompts = useCallback(async () => {
    if (!selectedCompany?.id) return;
    
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
  }, [selectedCompany?.id]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Handle URL parameter to auto-open a specific question's responses
  useEffect(() => {
    const openQuestionId = searchParams.get('openQuestion');
    if (openQuestionId && promptQuestions.length > 0) {
      // Find the question by ID
      const question = promptQuestions.find(q => q.id === openQuestionId);
      if (question) {
        // Convert PromptQuestion to PromptItem format
        const promptItem: PromptItem = {
          id: question.id,
          question: question.question,
          type: question.type || 'research',
          isCustom: question.source === 'user',
          usageCount: question.responses.length,
          lastUsed: question.responses[0]?.createdAt || question.createdAt || 'Unknown',
          status: question.isActive ? 'active' : 'suggested'
        };
        
        // Set as selected prompt and open responses
        setSelectedPrompt(promptItem);
        openEmbeddedPage('responses', 'Responses');
        
        // Clear the URL parameter
        setSearchParams({});
      }
    }
  }, [promptQuestions, searchParams, setSearchParams, openEmbeddedPage]);

  // Transform prompt questions to prompt format
  const allPrompts = useMemo(() => {
    // Convert prompt questions to prompt items with status logic
    const generatedPrompts: PromptItem[] = promptQuestions.map((q) => {
      // Check if we have a status override for this prompt
      const overrideStatus = promptStatusOverrides[q.id];
      
      let status: 'active' | 'inactive' | 'suggested';
      if (overrideStatus) {
        status = overrideStatus;
      } else {
        // Use database isActive field as the source of truth
        if (q.isActive) {
          status = 'active';
        } else {
          status = 'suggested';
        }
        
        // If a question is marked active but has no responses, it indicates a processing issue
        // Log this for debugging but don't change the status
        if (q.isActive && q.responses.length === 0) {
          console.warn(`Question "${q.question}" is marked active but has no responses - possible processing issue`);
        }
      }

      return {
        id: q.id,
        question: q.question,
        type: q.type || 'research',
        isCustom: q.source === 'user', // Questions created by users vs AI-generated
        usageCount: q.responses.length,
        lastUsed: q.createdAt || q.responses[0]?.createdAt || 'Unknown',
        status: status
      };
    });

    const combined = [...generatedPrompts];

    // Apply search filter
    let filtered = searchTerm
      ? combined.filter(p => 
          p.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.type && p.type.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : combined;

    // Apply status filter
    filtered = filtered.filter(p => p.status === statusFilter);

    // Sort by newest to oldest (prioritize creation date for recently added prompts)
    filtered.sort((a, b) => {
      // For newly created prompts, use the most recent date between creation and last response
      const getEffectiveDate = (prompt: PromptItem) => {
        if (prompt.lastUsed === 'Unknown') return new Date(0);
        return new Date(prompt.lastUsed);
      };
      
      const dateA = getEffectiveDate(a);
      const dateB = getEffectiveDate(b);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });

    // Apply limit if needed
    return showLimit === 'all' ? filtered : filtered.slice(0, parseInt(showLimit, 10));
  }, [promptQuestions, promptStatusOverrides, searchTerm, showLimit, statusFilter]);

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

  const handleAddPrompt = async (promptData: { question: string }) => {
    if (!selectedCompany) return;
    
    try {
      // Call API to create the question as active (no type needed)
      await addQuestion(selectedCompany.id, promptData.question, true);
      
      // Refresh the prompts data to get the new question from backend
      await fetchPrompts();
    } catch (error: unknown) {
      console.error('Failed to add question:', error);
      
      // Handle subscription-related errors gracefully
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response && error.response.status === 403) {
        if (isAdmin) {
          alert('Access denied. Please check your admin permissions.');
        } else {
          alert('Adding custom prompts requires a subscription. Please upgrade your plan to add custom prompts.');
        }
      } else {
        alert('Failed to add prompt. Please try again.');
      }
      
      throw error; // Re-throw to handle in the inline component
    }
  };

  const handleEditPrompt = (prompt: PromptItem) => {
    // Edit functionality pending UX design approval
    console.log('Edit prompt:', prompt);
  };

  const handleDeletePrompt = async (prompt: PromptItem) => {
    if (!selectedCompany) return;
    
    // Immediate UI feedback - remove from local state
    setPromptQuestions(prev => prev.filter(q => q.id !== prompt.id));
    
    try {
      // Call API to delete the question
      await deleteQuestion(selectedCompany.id, prompt.id);
      
      // Success - the item is already removed from UI
      
    } catch (error) {
      console.error('Failed to delete question:', error);
      
      // On error, restore the item by refreshing data
      await fetchPrompts();
      
      alert('Failed to delete prompt. Please try again.');
    }
  };

  const handleStatusChange = async (prompt: PromptItem, newStatus: 'active' | 'inactive' | 'suggested') => {
    if (!selectedCompany) return;
    
    // Immediate UI feedback - update status override first
    setPromptStatusOverrides(prev => ({
      ...prev,
      [prompt.id]: newStatus
    }));
    
    try {
      // Convert status to isActive boolean
      const isActive = newStatus === 'active';
      
      // Call API to persist the change
      await updateQuestionStatus(selectedCompany.id, prompt.id, isActive);
      
      // On success, we can optionally refresh to sync with backend
      // but the UI is already updated via the override above
      
    } catch (error) {
      console.error('Failed to update question status:', error);
      
      // On error, revert the optimistic update
      setPromptStatusOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[prompt.id];
        return newOverrides;
      });
      
      alert('Failed to update question status. Please try again.');
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
    <div className="h-full flex flex-col">
      {dashboardLoading || hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          _generationStatus={generationStatus}
          progress={progress}
          isButtonDisabled={isButtonDisabled}
          _generationState={generationState}
        />
      ) : (
        <>

          {/* Filter, Search and Add Bar */}
          <div className="flex-shrink-0 flex gap-4 mb-4 items-center justify-between">
            <div className="flex gap-4 items-center">
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
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-black transition-colors"
              />
            </div>
            <button
              onClick={() => setShowAddPrompt(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black transition-colors text-sm"
            >
              <Plus size={16} />
              Add Prompt
            </button>
            </div>
            
            {/* Prompt Counter */}
            <div className="px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md">
              <div className="text-sm text-gray-700">
                {(() => {
                  // Count all active prompts from raw data, not filtered by UI
                  const allActivePrompts = promptQuestions.filter(q => {
                    const overrideStatus = promptStatusOverrides[q.id];
                    const status = overrideStatus || (q.isActive ? 'active' : 'suggested');
                    return status === 'active';
                  }).length;
                  
                  
                  if (isAdmin) {
                    return `${allActivePrompts}/∞ Active`;
                  } else if (canModifyPrompts) {
                    return `${allActivePrompts}/∞ Active`;
                  } else {
                    return `${allActivePrompts}/5 Active`;
                  }
                })()}
              </div>
            </div>
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
                  className="mt-4 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black transition-colors flex items-center gap-2 mx-auto"
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
                    <div></div>
                  ) : (
                    <div>
                      {/* Floating Headers */}
                      <div className="px-4 mb-3">
                        <div className="grid grid-cols-[auto_1fr_8rem_6rem_6rem_5rem] gap-3 items-center">
                          {/* # Header */}
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">#</div>
                          
                          {/* Prompt Header */}
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prompt</div>
                          
                          {/* Mentions Header - shifted right */}
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Mentions</div>
                          
                          {/* Citations Header - shifted right */}
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Citations</div>
                          
                          {/* Created Header - shifted right */}
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Created</div>
                          
                          {/* Actions space - no header */}
                          <div></div>
                        </div>
                      </div>
                      
                      {/* Conditional Inline Add Prompt - appears as position 0 */}
                      {showAddPrompt && (
                        <AddPromptInline 
                          onSave={handleAddPrompt} 
                          onCancel={() => setShowAddPrompt(false)}
                          canModifyPrompts={canModifyPrompts}
                          isAdmin={isAdmin}
                        />
                      )}
                      
                      {allPrompts.map((prompt, index) => (
                        <PromptListItem
                          key={prompt.id}
                          prompt={prompt}
                          index={showAddPrompt ? index + 1 : index}
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
    </div>
  );
};

export default PromptsPage;