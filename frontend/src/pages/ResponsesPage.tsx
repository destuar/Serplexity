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
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import FilterDropdown from "../components/dashboard/FilterDropdown";
import BlankLoadingState from "../components/ui/BlankLoadingState";
import FormattedResponseViewer from "../components/ui/FormattedResponseViewer";
import { useCompany } from "../contexts/CompanyContext";
import { getCompanyLogo } from "../lib/logoService";
import {
  CitationData,
  CompetitorData,
  PromptQuestion,
  getAcceptedCompetitors,
  getCitations,
  getPromptsWithResponses,
} from "../services/companyService";
import { MODEL_CONFIGS, getModelDisplayName } from "../types/dashboard";

interface ResponsesPageProps {
  prompt: {
    id: string;
    question: string;
    type?: string;
    isCustom?: boolean;
    usageCount?: number;
    lastUsed?: string;
    status?: "active" | "inactive" | "suggested";
  };
}

// Utility function to format date for display
const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Utility function to format time for display
const formatTimeDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Get citation icons with overflow handling - cross-references citation IDs with database
const _getCitationIcons = (
  citationIds: string[],
  allCitations: CitationData[],
  maxDisplay: number = 4
): Array<{
  name: string;
  url: string;
  domain: string;
  isOverflow?: boolean;
  count?: number;
}> => {
  if (
    !citationIds ||
    citationIds.length === 0 ||
    !allCitations ||
    allCitations.length === 0
  ) {
    return [];
  }

  // Cross-reference citation IDs with actual citation data
  const matchedCitations = citationIds
    .map((citationId) =>
      allCitations.find((citation) => citation.id === citationId)
    )
    .filter((citation) => citation !== undefined) as CitationData[];

  const uniqueCitations = [
    ...new Map(
      matchedCitations.map((citation) => [citation.id, citation])
    ).values(),
  ];
  const citationItems = uniqueCitations.map((citation) => ({
    name: citation.title || citation.domain,
    url: citation.url,
    domain: citation.domain,
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
      url: "",
      domain: "",
      isOverflow: true,
      count: remaining,
    },
  ];
};

// Get competitor logos with overflow handling - only shows accepted competitors
const getCompetitorLogos = (
  brands: string[],
  acceptedCompetitors: unknown,
  maxDisplay: number = 4
): Array<{
  name: string;
  logoUrl: string;
  isOverflow?: boolean;
  count?: number;
}> => {
  // Handle case where acceptedCompetitors might be an object with competitors property
  const competitorsList = Array.isArray(acceptedCompetitors)
    ? acceptedCompetitors
    : acceptedCompetitors &&
        typeof acceptedCompetitors === "object" &&
        "competitors" in acceptedCompetitors
      ? (acceptedCompetitors as { competitors: unknown }).competitors
      : null;

  if (
    !Array.isArray(competitorsList) ||
    competitorsList.length === 0 ||
    !brands ||
    brands.length === 0
  ) {
    return [];
  }

  // Filter brands to only include accepted competitors
  const filteredBrands = brands.filter((brand) =>
    competitorsList.some(
      (comp) => comp.name.toLowerCase() === brand.toLowerCase()
    )
  );

  const uniqueBrands = [...new Set(filteredBrands)];
  const competitors = uniqueBrands.map((brand) => {
    const competitor = competitorsList.find(
      (comp) => comp.name.toLowerCase() === brand.toLowerCase()
    );
    const websiteUrl =
      competitor?.website || `${brand.toLowerCase().replace(/\s+/g, "")}.com`;
    const logoResult = getCompanyLogo(websiteUrl);
    return {
      name: brand,
      logoUrl: logoResult.url,
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
      logoUrl: "",
      isOverflow: true,
      count: remaining,
    },
  ];
};

interface ResponseItemData {
  id: string;
  model: string;
  response: string;
  position: number | null;
  brands: string[];
  createdAt: string;
  runId: string;
  runDate: string;
}

const ResponseListItem: React.FC<{
  response: ResponseItemData;
  index: number;
  acceptedCompetitors: unknown;
  citations: CitationData[];
  isExpanded: boolean;
  onToggle: () => void;
  question: string;
}> = ({
  response,
  index: _index,
  acceptedCompetitors,
  citations: _citations,
  isExpanded,
  onToggle,
  question,
}) => {
  const companyLogos = getCompetitorLogos(
    response.brands || [],
    acceptedCompetitors || [],
    4
  );
  // Use brands length as citation count since citations field doesn't exist in PromptResponse
  const citationCount = response.brands?.length || 0;
  const modelConfig = MODEL_CONFIGS[response.model];

  return (
    <div
      className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all cursor-pointer mb-3 ml-12"
      onClick={onToggle}
    >
      <div className="px-4 py-3">
        <div className="grid grid-cols-[1fr_8rem_6rem_3rem] gap-3 items-center">
          {/* Model */}
          <div className="min-w-0 flex items-center gap-2">
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
                {companyLogos.map((competitor, logoIndex) =>
                  competitor.isOverflow ? (
                    <div
                      key={`overflow-${logoIndex}`}
                      className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shadow-md"
                      title={competitor.name}
                      style={{
                        marginLeft: logoIndex > 0 ? "-14px" : "0",
                        zIndex: companyLogos.length - logoIndex,
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
                        marginLeft: logoIndex > 0 ? "-14px" : "0",
                        zIndex: companyLogos.length - logoIndex,
                      }}
                    >
                      <img
                        src={competitor.logoUrl}
                        alt={competitor.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = competitor.name
                              .charAt(0)
                              .toUpperCase();
                            parent.classList.add(
                              "text-xs",
                              "font-medium",
                              "text-gray-600",
                              "bg-gray-100"
                            );
                          }
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Citations */}
          <div className="pl-2">
            <div className="text-xs text-gray-500">
              {citationCount > 0 ? citationCount : "-"}
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
                {formatDateDisplay(response.runDate)} at{" "}
                {formatTimeDisplay(response.runDate)}
              </span>
            </div>
          </div>

          {/* Chat Conversation */}
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-4 py-3 rounded-tr-md">
                  <p className="text-gray-900 text-sm leading-relaxed">
                    {question}
                  </p>
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
                      alt={getModelDisplayName(response.model)}
                      className="w-5 h-5 rounded object-contain"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-600">
                      {getModelDisplayName(response.model).charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-4 py-3 rounded-tl-md">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        {getModelDisplayName(response.model)}
                      </span>
                      {response.position && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Rank #{response.position}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-900 text-sm leading-relaxed">
                      <FormattedResponseViewer text={response.response} />
                    </div>
                  </div>

                  {/* Mentions and Citations - below the chat bubble */}
                  {(companyLogos.length > 0 || citationCount > 0) && (
                    <div className="mt-2 flex items-center gap-4 px-4">
                      {/* Company Mentions */}
                      {companyLogos.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">
                            Mentions:
                          </span>
                          <div className="flex items-center gap-1">
                            {companyLogos.map((competitor, logoIndex) =>
                              competitor.isOverflow ? (
                                <div
                                  key={`overflow-${logoIndex}`}
                                  className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600"
                                  title={competitor.name}
                                >
                                  +{competitor.count}
                                </div>
                              ) : (
                                <div
                                  key={`${competitor.name}-${logoIndex}`}
                                  className="w-5 h-5 rounded bg-white flex items-center justify-center overflow-hidden border border-gray-200"
                                  title={competitor.name}
                                >
                                  <img
                                    src={competitor.logoUrl}
                                    alt={competitor.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = competitor.name
                                          .charAt(0)
                                          .toUpperCase();
                                        parent.classList.add(
                                          "text-xs",
                                          "font-medium",
                                          "text-gray-600",
                                          "bg-gray-100"
                                        );
                                      }
                                    }}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Citations */}
                      {citationCount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">
                            Citations:
                          </span>
                          <span className="text-xs text-gray-500">
                            {citationCount}
                          </span>
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
};

const ResponsesPage: React.FC<ResponsesPageProps> = ({ prompt }) => {
  const { selectedCompany } = useCompany();

  // Local state
  const [responses, setResponses] = useState<ResponseItemData[]>([]);
  const [acceptedCompetitors, setAcceptedCompetitors] = useState<
    CompetitorData[]
  >([]);
  const [citations, setCitations] = useState<CitationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch accepted competitors and citations
  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchCompetitorsAndCitations = async () => {
        try {
          const [competitorsData, citationsData] = await Promise.all([
            getAcceptedCompetitors(selectedCompany.id),
            getCitations(selectedCompany.id),
          ]);
          setAcceptedCompetitors(competitorsData.competitors || []);
          setCitations(citationsData.citations || []);
        } catch (err) {
          console.error("Error fetching competitors and citations:", err);
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
          const promptQuestion = data.questions?.find(
            (q: PromptQuestion) => q.id === prompt.id
          );

          if (promptQuestion && promptQuestion.responses) {
            // Transform responses to the format we need
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedResponses: ResponseItemData[] =
              promptQuestion.responses.map((resp: any, _index: number) => {
                return {
                  id: `${resp.model}-${_index}`,
                  model: resp.model,
                  response: resp.response,
                  position: resp.position,
                  brands: resp.brands || [],
                  createdAt: resp.createdAt || new Date().toISOString(),
                  runId: resp.runId || "unknown",
                  runDate:
                    resp.runDate || resp.createdAt || new Date().toISOString(),
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

            // Auto-expand the first response if this was navigated from top ranking questions
            if (transformedResponses.length > 0) {
              setExpandedItems(new Set([transformedResponses[0].id]));
            }
          } else {
            setResponses([]);
          }
          setError(null);
        } catch (err) {
          console.error("Error fetching responses:", err);
          setError("Failed to load response data");
        } finally {
          setIsLoading(false);
        }
      };

      fetchResponses();
    }
  }, [selectedCompany?.id, prompt?.id]);

  const toggleExpanded = (responseId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };

  // Filter and group responses by report ID
  const { filteredResponses, responsesByReport } = useMemo(() => {
    let filtered = [...responses];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((response) => {
        // Search in response text and model name
        const basicMatch =
          response.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
          getModelDisplayName(response.model)
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          response.brands.some((brand) =>
            brand.toLowerCase().includes(searchTerm.toLowerCase())
          );

        return basicMatch;
      });
    }

    // Apply model filter
    if (modelFilter !== "all") {
      filtered = filtered.filter((response) => response.model === modelFilter);
    }

    // Apply time filter
    if (timeFilter !== "all") {
      const now = new Date();
      const cutoff = new Date();

      switch (timeFilter) {
        case "24h":
          cutoff.setHours(now.getHours() - 24);
          break;
        case "7d":
          cutoff.setDate(now.getDate() - 7);
          break;
        case "30d":
          cutoff.setDate(now.getDate() - 30);
          break;
        default:
          break;
      }

      if (timeFilter !== "all") {
        filtered = filtered.filter(
          (response) => new Date(response.runDate) >= cutoff
        );
      }
    }

    // Group responses by report ID
    const grouped = filtered.reduce(
      (acc, response) => {
        const reportKey = response.runId;
        if (!acc[reportKey]) {
          acc[reportKey] = [];
        }
        acc[reportKey].push(response);
        return acc;
      },
      {} as Record<string, ResponseItemData[]>
    );

    // Sort report groups (most recent first) and sort responses within each group
    const sortedReportKeys = Object.keys(grouped).sort((a, b) => {
      // Sort by report date (runDate) for proper chronological sorting
      const dateA = grouped[a][0]?.runDate;
      const dateB = grouped[b][0]?.runDate;
      return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
    });

    const sortedGrouped = sortedReportKeys.reduce(
      (acc, reportKey) => {
        // Sort responses within each report group by position (lower is better), null positions go to end
        acc[reportKey] = grouped[reportKey].sort((a, b) => {
          if (a.position === null && b.position === null) return 0;
          if (a.position === null) return 1;
          if (b.position === null) return -1;
          return a.position - b.position;
        });
        return acc;
      },
      {} as Record<string, ResponseItemData[]>
    );

    return {
      filteredResponses: filtered,
      responsesByReport: sortedGrouped,
    };
  }, [responses, timeFilter, modelFilter, searchTerm]);

  // Get unique models for filter dropdown
  const { activeModelPreferences } = useDashboard();
  const modelFilterOptions = useMemo(() => {
    const enabled = activeModelPreferences
      ? new Set(
          Object.entries(activeModelPreferences)
            .filter(([, v]) => v)
            .map(([k]) => k)
        )
      : null;

    const uniqueModels = [...new Set(responses.map((r) => r.model))];
    const visibleModels = enabled
      ? uniqueModels.filter((m) => enabled.has(m))
      : uniqueModels;

    const baseOptions = [{ value: "all", label: "All Models" }];
    const modelOptions = visibleModels.map((model) => {
      const modelConfig = MODEL_CONFIGS[model];
      return {
        value: model,
        label: getModelDisplayName(model),
        logoUrl: modelConfig?.logoUrl,
      };
    });

    return [...baseOptions, ...modelOptions];
  }, [responses, activeModelPreferences]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex gap-4 items-center">
        <FilterDropdown
          label="Time"
          value={timeFilter}
          options={[
            { value: "all", label: "All Time" },
            { value: "24h", label: "Last 24 Hours" },
            { value: "7d", label: "Last 7 Days" },
            { value: "30d", label: "Last 30 Days" },
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
          icon={modelFilter === "all" ? Sparkles : undefined}
          disabled={isLoading}
        />
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10"
          />
          <input
            type="text"
            placeholder="Search responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-80 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-black transition-colors"
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
                    {prompt.question}
                  </p>
                </div>

                {/* Response Count */}
                <div className="flex-shrink-0">
                  <div className="text-xs text-gray-500">
                    {filteredResponses.length} response
                    {filteredResponses.length !== 1 ? "s" : ""}
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
              <p className="text-xl font-semibold text-gray-500">
                Failed to load response data
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {Object.keys(responsesByReport).length === 0 ? (
              <div></div>
            ) : (
              <div className="space-y-8">
                {Object.entries(responsesByReport).map(
                  ([reportKey, reportResponses]) => {
                    const firstResponse = reportResponses[0];
                    if (!firstResponse) return null;

                    return (
                      <div key={reportKey} className="space-y-3">
                        {/* Report Date and Headers for this report group */}
                        <div className="px-4 mb-3">
                          <div className="grid grid-cols-[1fr_8rem_6rem_3rem] gap-3 items-center ml-12">
                            <div className="text-sm text-gray-600 font-medium">
                              {formatDateDisplay(firstResponse.runDate)} at{" "}
                              {formatTimeDisplay(firstResponse.runDate)}
                            </div>

                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-2">
                              Mentions
                            </div>

                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pl-2">
                              Citations
                            </div>

                            <div></div>
                          </div>
                        </div>

                        {/* Responses for this report */}
                        <div className="space-y-3">
                          {reportResponses.map((response, index) => (
                            <ResponseListItem
                              key={response.id}
                              response={response}
                              index={index}
                              acceptedCompetitors={acceptedCompetitors}
                              citations={citations}
                              isExpanded={expandedItems.has(response.id)}
                              onToggle={() => toggleExpanded(response.id)}
                              question={prompt.question}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponsesPage;
