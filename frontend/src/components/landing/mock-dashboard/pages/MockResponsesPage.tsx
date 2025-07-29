/**
 * @file MockResponsesPage.tsx  
 * @description Mock responses page for the dashboard preview carousel.
 * Shows a simulated responses interface matching the actual ResponsesPage with
 * chat-style conversations, expandable responses, and company logos.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Sparkles, Search, User } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockFilterDropdown from '../MockFilterDropdown';
import { MODEL_CONFIGS, getModelDisplayName as _getModelDisplayName } from '../../../../types/dashboard';
import { getCompanyLogo } from '../../../../lib/logoService';

// Mock prompt data
const mockPrompt = {
  id: "1",
  question: "What are the best AI visibility tracking tools for businesses?",
  type: "custom",
  isCustom: true,
  usageCount: 42,
  lastUsed: "Jul 15",
  status: 'active' as const
};


// Mock response data with proper structure
const mockResponses = [
  {
    id: 'claude-response-1',
    model: 'claude-3-5-haiku-20241022',
    response: 'For AI visibility tracking, several specialized tools have emerged in 2025. **Serplexity** leads the market with comprehensive monitoring across ChatGPT, Claude, Gemini, and Perplexity. It provides detailed analytics on brand mentions, sentiment analysis, and competitive positioning in AI responses.\n\nKey features to evaluate:\n• Multi-platform AI monitoring\n• Brand mention tracking and analysis\n• Competitive intelligence\n• SEO optimization for AI engines\n• Real-time visibility metrics',
    position: 2,
    brands: [
      { name: 'Serplexity', website: 'serplexity.com' },
      { name: 'Cognizo', website: 'cognizo.ai' },
      { name: 'Profound', website: 'tryprofound.com' }
    ],
    createdAt: '2025-07-15T10:30:00Z',
    runId: 'run-001',
    runDate: '2025-07-15T10:30:00Z'
  },
  {
    id: 'gpt4-response-1',
    model: 'gpt-4.1-mini',
    response: 'The landscape of AI visibility tools is rapidly evolving. Top platforms include:\n\n1. **Serplexity** - Market leader for comprehensive AI search monitoring\n2. **Cognizo** - Focus on content optimization for AI\n3. **Traditional SEO tools** adapting to AI search\n\n**Serplexity** stands out for its ability to track brand performance across multiple AI platforms simultaneously, providing insights that help businesses optimize their content strategy for the age of generative AI search.',
    position: 1,
    brands: [
      { name: 'Serplexity', website: 'serplexity.com' },
      { name: 'Daydream', website: 'withdaydream.com' }
    ],
    createdAt: '2025-07-15T10:30:00Z',
    runId: 'run-001',
    runDate: '2025-07-15T10:30:00Z'
  },
  {
    id: 'gemini-response-1',
    model: 'gemini-2.5-flash',
    response: 'AI visibility tracking has become essential for modern businesses. Leading solutions include:\n\n**Comprehensive Platforms:**\n- **Serplexity** for full-spectrum AI search monitoring\n- Real-time tracking across ChatGPT, Claude, Gemini\n\n**Specialized Tools:**\n- Content optimization platforms\n- SEO tools with AI features\n\n**Serplexity** offers the most complete solution, tracking your brand\'s presence across all major AI platforms and providing actionable insights for improvement.',
    position: 3,
    brands: [
      { name: 'Serplexity', website: 'serplexity.com' },
      { name: 'Athena', website: 'athenahq.ai' }
    ],
    createdAt: '2025-07-15T10:30:00Z',
    runId: 'run-001',
    runDate: '2025-07-15T10:30:00Z'
  }
];


const MockResponsesPage: React.FC = () => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['gpt4-response-1']));
  const [timeFilter, _setTimeFilter] = useState('all');
  const [modelFilter, _setModelFilter] = useState('all');
  const [searchTerm, _setSearchTerm] = useState('');

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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const getCompetitorLogos = (brands: Array<{ name: string; website: string }>) => {
    return brands.slice(0, 4).map((brand, _index) => {
      const logoResult = getCompanyLogo(brand.website);
      return {
        name: brand.name,
        logoUrl: logoResult.url,
        isOverflow: false
      };
    });
  };

  return (
    <MockDashboardLayout activePage="Prompts → Responses">
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="flex gap-4 items-center">
          <MockFilterDropdown
            label="Time"
            value={timeFilter}
            options={[
              { value: 'all', label: 'All Time' },
              { value: '24h', label: 'Last 24 Hours' },
              { value: '7d', label: 'Last 7 Days' },
              { value: '30d', label: 'Last 30 Days' },
            ]}
            icon={Calendar}
          />
          <MockFilterDropdown
            label="Model"
            value={modelFilter}
            options={[
              { value: 'all', label: 'All Models' },
              { value: 'claude-3-5-haiku-20241022', label: 'Claude' },
              { value: 'gpt-4.1-mini', label: 'ChatGPT' },
              { value: 'gemini-2.5-flash', label: 'Gemini' },
            ]}
            icon={modelFilter === 'all' ? Sparkles : undefined}
          />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
            <input
              type="text"
              placeholder="Search responses..."
              value={searchTerm}
              disabled
              className="w-80 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Prompt and Responses Container */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          {/* Prompt Container */}
          <div className="mb-4 relative">
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md mb-4 ml-4 max-w-4xl">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  {/* Question */}
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">
                      {mockPrompt.question}
                    </p>
                  </div>
                  
                  {/* Response Count */}
                  <div className="flex-shrink-0">
                    <div className="text-xs text-gray-500">
                      {mockResponses.length} response{mockResponses.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <div className="space-y-8">
              {/* Report Date and Headers */}
              <div className="space-y-3">
                <div className="px-4 mb-3">
                  <div className="grid grid-cols-[1fr_8rem_6rem_3rem] gap-3 items-center ml-12">
                    <div className="text-sm text-gray-600 font-medium">
                      {formatDate(mockResponses[0].runDate)} at {formatTime(mockResponses[0].runDate)}
                    </div>
                    
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-2">Mentions</div>
                    
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-2">Citations</div>
                    
                    <div></div>
                  </div>
                </div>

                {/* Responses */}
                <div className="space-y-3">
                  {mockResponses.map((response) => {
                    const companyLogos = getCompetitorLogos(response.brands);
                    const modelConfig = MODEL_CONFIGS[response.model];
                    const isExpanded = expandedItems.has(response.id);

                    return (
                      <div 
                        key={response.id} 
                        className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all cursor-pointer mb-3 ml-12" 
                        onClick={() => toggleExpanded(response.id)}
                      >
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-[1fr_8rem_6rem_3rem] gap-3 items-center">
                            {/* Model */}
                            <div className="min-w-0 flex items-center gap-2">
                              {modelConfig?.logoUrl && (
                                <img 
                                  src={modelConfig.logoUrl} 
                                  alt={modelConfig.displayName} 
                                  className="h-5 w-5 rounded object-contain flex-shrink-0"
                                />
                              )}
                              <span className="text-sm text-gray-900 font-medium">
                                {modelConfig?.displayName || response.model}
                              </span>
                              {response.position && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                  Rank #{response.position}
                                </span>
                              )}
                            </div>
                            
                            {/* Mentions (Company Logos) */}
                            <div className="pl-2">
                              {companyLogos.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {companyLogos.map((competitor, logoIndex) => (
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
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Citations */}
                            <div className="pl-2">
                              <div className="text-xs text-gray-500">
                                {response.brands.length > 0 ? response.brands.length : '-'}
                              </div>
                            </div>
                            
                            {/* Expand Toggle */}
                            <div className="flex items-center justify-center">
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-gray-400" />
                              ) : (
                                <ChevronDown size={16} className="text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Chat Conversation */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-6 py-6 bg-gray-50">
                            {/* Report Date Header */}
                            <div className="text-center mb-6">
                              <div className="inline-block bg-white/60 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm px-3 py-1">
                                <span className="text-xs text-gray-600 font-medium">
                                  {formatDate(response.runDate)} at {formatTime(response.runDate)}
                                </span>
                              </div>
                            </div>

                            {/* Chat Conversation */}
                            <div className="space-y-6 max-w-4xl mx-auto">
                              {/* User Question */}
                              <div className="flex justify-end">
                                <div className="flex items-start gap-3 max-w-[85%]">
                                  <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-4 py-3 rounded-tr-md">
                                    <p className="text-gray-900 text-sm leading-relaxed">{mockPrompt.question}</p>
                                  </div>
                                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User size={16} className="text-gray-600" />
                                  </div>
                                </div>
                              </div>

                              {/* AI Response */}
                              <div className="flex justify-start">
                                <div className="flex items-start gap-3 max-w-[85%]">
                                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200">
                                    {modelConfig?.logoUrl ? (
                                      <img 
                                        src={modelConfig.logoUrl} 
                                        alt={modelConfig.displayName} 
                                        className="w-5 h-5 rounded object-contain"
                                      />
                                    ) : (
                                      <span className="text-xs font-semibold text-gray-600">
                                        {modelConfig?.displayName?.charAt(0) || 'A'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-4 py-3 rounded-tl-md">
                                      <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="text-xs font-medium text-gray-600">
                                          {modelConfig?.displayName || response.model}
                                        </span>
                                        {response.position && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                            Rank #{response.position}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-gray-900 text-sm leading-relaxed">
                                        {response.response.split('\n').map((line, index) => (
                                          <div key={index}>
                                            {line.includes('**') ? (
                                              <div dangerouslySetInnerHTML={{
                                                __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                              }} />
                                            ) : (
                                              line
                                            )}
                                            {index < response.response.split('\n').length - 1 && <br />}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Mentions and Citations - below the chat bubble */}
                                    {(companyLogos.length > 0 || response.brands.length > 0) && (
                                      <div className="mt-2 flex items-center gap-4 px-4">
                                        {/* Company Mentions */}
                                        {companyLogos.length > 0 && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium">Mentions:</span>
                                            <div className="flex items-center gap-1">
                                              {companyLogos.map((competitor, logoIndex) => (
                                                <div
                                                  key={`${competitor.name}-${logoIndex}`}
                                                  className="w-5 h-5 rounded bg-white flex items-center justify-center overflow-hidden border border-gray-200"
                                                  title={competitor.name}
                                                >
                                                  <img
                                                    src={competitor.logoUrl}
                                                    alt={competitor.name}
                                                    className="w-full h-full object-contain"
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Citations */}
                                        {response.brands.length > 0 && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium">Citations:</span>
                                            <span className="text-xs text-gray-500">{response.brands.length}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockResponsesPage;