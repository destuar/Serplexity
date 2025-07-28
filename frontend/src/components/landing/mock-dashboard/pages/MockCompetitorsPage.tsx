/**
 * @file MockCompetitorsPage.tsx
 * @description Mock competitors page for the dashboard preview carousel.
 * Shows a simulated competitor management interface matching the actual CompetitorsPage with
 * competitor list, logos, status badges, and edit functionality.
 */
import React, { useState } from 'react';
import { Check, X, Plus, ExternalLink, Edit2 } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import { getCompanyLogo } from '../../../../lib/logoService';

const MockCompetitorsPage: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Separate data for suggested and accepted competitors
  const suggestedCompetitors = [
    {
      id: "5",
      name: "Cognizo",
      website: "cognizo.ai",
      mentions: 98,
      status: 'suggested' as const
    },
    {
      id: "6",
      name: "Daydream",
      website: "withdaydream.com",
      mentions: 45,
      status: 'suggested' as const
    },
    {
      id: "7",
      name: "Profound",
      website: "tryprofound.com",
      mentions: 32,
      status: 'suggested' as const
    }
  ];

  const yourCompetitors = [
    {
      id: "1",
      name: "Serplexity",
      website: "serplexity.com",
      mentions: 0,
      status: 'user-company' as const
    },
    {
      id: "2", 
      name: "Athena",
      website: "athenahq.ai",
      mentions: 142,
      status: 'accepted' as const
    },
    {
      id: "3",
      name: "Writesonic",
      website: "writesonic.com", 
      mentions: 89,
      status: 'accepted' as const
    },
    {
      id: "4",
      name: "Semrush",
      website: "semrush.com",
      mentions: 67,
      status: 'accepted' as const
    }
  ];

  const handleAccept = (id: string) => {
    // Mock function - would normally call API
    console.log('Accept competitor:', id);
  };

  const handleDecline = (id: string) => {
    // Mock function - would normally call API
    console.log('Decline competitor:', id);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleSaveEdit = (id: string, name: string, website: string) => {
    // Mock function - would normally call API
    console.log('Save edit:', id, name, website);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Suggested Competitor Card Component
  const SuggestedCompetitorCard: React.FC<{ competitor: any; index: number }> = ({ competitor }) => {
    const logoResult = getCompanyLogo(competitor.website);
    
    return (
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all p-3 w-full">
        {/* Company Info with Logo */}
        <div className="flex items-start gap-3 mb-1">
          {/* Company Logo */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
            <img
              src={logoResult.url}
              alt={`${competitor.name} logo`}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
              }}
            />
            <div 
              className="w-full h-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 rounded-lg"
              style={{ display: 'none' }}
            >
              {competitor.name.charAt(0).toUpperCase()}
            </div>
          </div>
          
          {/* Company Info */}
          <div className="flex-1 min-w-0">
            <div className="py-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                {competitor.name}
              </h3>
              <div className="space-y-1">
                {competitor.website && (
                  <a
                    href={`https://${competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{competitor.website}</span>
                    <ExternalLink size={10} className="ml-1 flex-shrink-0" />
                  </a>
                )}
                {competitor.mentions > 0 && (
                  <span className="text-xs text-gray-500">
                    {competitor.mentions} mention{competitor.mentions !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Edit button */}
          <div className="flex-shrink-0">
            <button
              disabled
              className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              title="Edit competitor"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={12} />
            Decline
          </button>
          <button
            disabled
            className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={12} />
            Accept
          </button>
        </div>
      </div>
    );
  };

  return (
    <MockDashboardLayout activePage="Competitors">
      <div className="flex-1 min-h-0 p-1">
        <div className="h-full w-full flex flex-col">
          {/* Suggested Competitors Section - At top */}
          {suggestedCompetitors.length > 0 && (
            <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md overflow-hidden w-full mb-6">
              <div className="px-4 py-2">
                <h2 className="text-sm font-medium text-gray-900">
                  Suggested
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({suggestedCompetitors.length})
                  </span>
                </h2>
              </div>
              <div className="px-4 pt-1 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {suggestedCompetitors.map((competitor, index) => (
                    <SuggestedCompetitorCard
                      key={competitor.id}
                      competitor={competitor}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Your Competitors Section - Scrollable */}
          <div className="flex-1 min-h-0">
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md overflow-hidden h-full flex flex-col">
              <div className="px-4 py-2 flex-shrink-0 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-900">
                  Your Competitors
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({yourCompetitors.length})
                  </span>
                </h2>
                <button
                  disabled
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={12} />
                  Add Competitor
                </button>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-4">
                {yourCompetitors.map((competitor, index) => {
                  const logoResult = getCompanyLogo(competitor.website);
                  const isUserCompany = competitor.status === 'user-company';
                  const isEditing = editingId === competitor.id;

                  return (
                    <div 
                      key={competitor.id}
                      className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all mb-3"
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Number */}
                            <div className="flex-shrink-0 w-8 flex items-center justify-center text-sm font-medium text-gray-600">
                              {index + 1}
                            </div>
                            
                            {/* Company Logo */}
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
                              <img
                                src={logoResult.url}
                                alt={`${competitor.name} logo`}
                                className="w-10 h-10 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                                }}
                              />
                              <div 
                                className="w-full h-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 rounded-lg"
                                style={{ display: 'none' }}
                              >
                                {competitor.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            
                            {/* Company Info */}
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="space-y-0 max-w-xs">
                                  <input
                                    type="text"
                                    defaultValue={competitor.name}
                                    className="w-full px-2 py-0.5 text-sm font-medium text-gray-900 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm"
                                    placeholder="Company name"
                                    disabled
                                  />
                                  <input
                                    type="text"
                                    defaultValue={competitor.website}
                                    className="w-full px-2 py-0.5 text-xs text-gray-600 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm"
                                    placeholder="https://company.com"
                                    disabled
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                                      {competitor.name}
                                    </h3>
                                    {isUserCompany && (
                                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                        Your brand
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    {competitor.website && (
                                      <a
                                        href={`https://${competitor.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 flex items-center truncate max-w-48"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="truncate">{competitor.website}</span>
                                        <ExternalLink size={12} className="ml-1 flex-shrink-0" />
                                      </a>
                                    )}
                                    {competitor.mentions > 0 && (
                                      <span className="text-gray-500">
                                        {competitor.mentions} mention{competitor.mentions !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isEditing ? (
                              <>
                                {/* Save button (check) */}
                                <button
                                  onClick={() => handleSaveEdit(competitor.id, competitor.name, competitor.website || '')}
                                  disabled
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save changes"
                                >
                                  <Check size={16} />
                                </button>
                                
                                {/* Cancel button (X) */}
                                <button
                                  onClick={handleCancelEdit}
                                  disabled
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel edit"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Edit button for all competitors except user company */}
                                {!isUserCompany && (
                                  <button
                                    onClick={() => handleEdit(competitor.id)}
                                    disabled
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Edit competitor"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                                
                                {/* Remove button for accepted competitors (except user company) */}
                                {!isUserCompany && (
                                  <button
                                    onClick={() => handleDecline(competitor.id)}
                                    disabled
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Remove competitor"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockCompetitorsPage;