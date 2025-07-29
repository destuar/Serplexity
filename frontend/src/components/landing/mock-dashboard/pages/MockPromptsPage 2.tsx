/**
 * @file MockPromptsPage.tsx
 * @description Mock prompts page for the dashboard preview carousel.
 * Shows a simulated prompts management interface matching the actual PromptsPage with
 * table-style list, inline editing, status management, and prompt metrics.
 */
import React, { useState } from 'react';
import { ListFilter, Search, Check as _Check, X, Trash2 as _Trash2, Plus } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockFilterDropdown from '../MockFilterDropdown';
import { getCompanyLogo } from '../../../../lib/logoService';

const MockPromptsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data with company websites for real logos
  const mockPrompts = [
    {
      id: "1",
      question: "What are the best AI visibility tracking tools for businesses?",
      type: "suggested",
      isCustom: false,
      usageCount: 42,
      lastUsed: "Jul 15",
      status: 'active' as const,
      brands: [
        { name: 'Serplexity', website: 'serplexity.com' },
        { name: 'Cognizo', website: 'cognizo.ai' },
        { name: 'Profound', website: 'tryprofound.com' }
      ]
    },
    {
      id: "2", 
      question: "How can I track my brand mentions in AI search results?",
      type: "default",
      isCustom: false,
      usageCount: 38,
      lastUsed: "Jul 16",
      status: 'active' as const,
      brands: [
        { name: 'Serplexity', website: 'serplexity.com' },
        { name: 'Daydream', website: 'withdaydream.com' }
      ]
    },
    {
      id: "3",
      question: "What tools help optimize content for generative AI search engines?",
      type: "custom",
      isCustom: true,
      usageCount: 31,
      lastUsed: "Jul 18",
      status: 'active' as const,
      brands: [
        { name: 'Serplexity', website: 'serplexity.com' },
        { name: 'Athena', website: 'athenahq.ai' }
      ]
    },
    {
      id: "4",
      question: "Which platforms offer AI-powered SEO and visibility analytics?",
      type: "default",
      isCustom: false,
      usageCount: 56,
      lastUsed: "Jul 20",
      status: 'active' as const,
      brands: [
        { name: 'Serplexity', website: 'serplexity.com' },
        { name: 'Semrush', website: 'semrush.com' },
        { name: 'Writesonic', website: 'writesonic.com' }
      ]
    },
    {
      id: "5",
      question: "How do I improve my brand's visibility in ChatGPT and Claude responses?",
      type: "suggested",
      isCustom: false,
      usageCount: 29,
      lastUsed: "Jul 22",
      status: 'active' as const,
      brands: [
        { name: 'Serplexity', website: 'serplexity.com' },
        { name: 'Goodie', website: 'higoodie.com' }
      ]
    }
  ];

  const getCompetitorLogos = (brands: Array<{ name: string; website: string }>) => {
    return brands.slice(0, 4).map((brand, index) => {
      const logoResult = getCompanyLogo(brand.website);
      return {
        name: brand.name,
        logoUrl: logoResult.url,
        isOverflow: false
      };
    });
  };

  return (
    <MockDashboardLayout activePage="Prompts">
      <div className="space-y-4">
        {/* Filter, Search and Add Bar */}
        <div className="flex-shrink-0 flex gap-4 mb-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <MockFilterDropdown
              label="Status"
              value={statusFilter}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suggested', label: 'Suggested' },
              ]}
              icon={ListFilter}
            />
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                disabled
                className="w-80 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 active:shadow-inner"
            >
              <Plus size={16} />
              Add Custom Prompt
            </button>
            <div className="text-sm text-gray-500">
              5/5 Active
            </div>
          </div>
        </div>

        {/* Prompts Container */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          {/* Headers */}
          <div className="px-4 mb-3">
            <div className="grid grid-cols-[auto_1fr_8rem_6rem_6rem_5rem] gap-3 items-center">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">#</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prompt</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Mentions</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Citations</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-6">Created</div>
              <div></div>
            </div>
          </div>

          {/* Prompt List */}
          <div className="space-y-3">
            {mockPrompts.map((prompt, index) => {
              const companyLogos = getCompetitorLogos(prompt.brands);
              const totalCitations = prompt.brands.length;

              return (
                <div 
                  key={prompt.id}
                  className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all cursor-pointer mb-3"
                >
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
                      <div className="text-xs text-gray-500 pl-6">
                        {totalCitations > 0 ? totalCitations : '-'}
                      </div>
                      
                      {/* Created Time */}
                      <div className="text-xs text-gray-500 pl-6">
                        {prompt.lastUsed}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          disabled
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Mark as Inactive"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockPromptsPage;