/**
 * @file CompetitorsPage.tsx
 * @description Competitor management page for viewing and managing competitors.
 * Displays companies in a list format with logos, allows accepting/declining suggested competitors.
 */
import { Check, Edit2, ExternalLink, Plus, Users, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { useDashboard } from "../hooks/useDashboard";
import { useNavigation } from "../hooks/useNavigation";
import { usePageCache } from "../hooks/usePageCache";
import { getCompanyLogo } from "../lib/logoService";
// import { cn } from '../lib/utils';
import BlankLoadingState from "../components/ui/BlankLoadingState";
import WelcomePrompt from "../components/ui/WelcomePrompt";
import { useReportGeneration } from "../hooks/useReportGeneration";
import {
  CompetitorData,
  acceptCompetitor,
  addCompetitor,
  declineCompetitor,
  deleteCompetitor,
  getAcceptedCompetitors,
  getSuggestedCompetitors,
  updateCompetitor,
} from "../services/companyService";

interface CompetitorItem extends CompetitorData {
  status: "accepted" | "suggested" | "user-company";
}

const CompetitorListItem: React.FC<{
  competitor: CompetitorItem;
  index: number;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onEdit?: (competitor: CompetitorItem) => void;
  onRemove?: (id: string) => void;
  isEditing?: boolean;
  onSaveEdit?: (id: string, name: string, website: string) => void;
  onCancelEdit?: () => void;
  isUpdating?: boolean;
}> = ({
  competitor,
  index,
  onAccept,
  onDecline,
  onEdit,
  onRemove,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  isUpdating,
}) => {
  const logoResult = competitor.website
    ? getCompanyLogo(competitor.website)
    : null;
  const isUserCompany = competitor.status === "user-company";
  const isSuggested = competitor.status === "suggested";

  const [editName, setEditName] = React.useState(competitor.name);
  const [editWebsite, setEditWebsite] = React.useState(
    competitor.website || ""
  );

  React.useEffect(() => {
    setEditName(competitor.name);
    setEditWebsite(competitor.website || "");
  }, [competitor.name, competitor.website, isEditing]);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all mb-3">
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Number */}
            <div className="flex-shrink-0 w-8 flex items-center justify-center text-sm font-medium text-gray-600">
              {index + 1}
            </div>

            {/* Company Logo */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
              {logoResult ? (
                <img
                  src={logoResult.url}
                  alt={`${competitor.name} logo`}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.setAttribute(
                      "style",
                      "display: flex"
                    );
                  }}
                />
              ) : null}
              <div
                className="w-full h-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 rounded-lg"
                style={{ display: logoResult ? "none" : "flex" }}
              >
                {competitor.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Company Info - Editable when in edit mode */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-0 max-w-xs">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-0.5 text-sm font-medium text-gray-900 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm"
                    placeholder="Company name"
                  />
                  <input
                    type="text"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full px-2 py-0.5 text-xs text-gray-600 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm"
                    placeholder="https://company.com"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {competitor.name}
                    </h3>
                    {isSuggested && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Suggested
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {competitor.website && (
                      <a
                        href={
                          competitor.website.startsWith("http")
                            ? competitor.website
                            : `https://${competitor.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center truncate max-w-48"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">
                          {competitor.website.replace(/^https?:\/\//, "")}
                        </span>
                        <ExternalLink
                          size={12}
                          className="ml-1 flex-shrink-0"
                        />
                      </a>
                    )}
                    {competitor.mentions !== undefined &&
                      competitor.mentions > 0 && (
                        <span className="text-gray-500">
                          {competitor.mentions} mention
                          {competitor.mentions !== 1 ? "s" : ""}
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
                {/* Save button (check) - replaces edit button position */}
                <button
                  onClick={() =>
                    onSaveEdit?.(
                      competitor.id,
                      editName.trim(),
                      editWebsite.trim()
                    )
                  }
                  disabled={
                    !editName.trim() || !editWebsite.trim() || isUpdating
                  }
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes"
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check size={16} />
                  )}
                </button>

                {/* Cancel button (X) - stays in remove/decline position */}
                <button
                  onClick={() => onCancelEdit?.()}
                  disabled={isUpdating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50"
                  title="Cancel edit"
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                {/* Edit button for all competitors except user company */}
                {!isUserCompany && (
                  <button
                    onClick={() => onEdit?.(competitor)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                    title="Edit competitor"
                    style={{
                      WebkitTapHighlightColor: "transparent",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                )}

                {/* Remove button for accepted competitors (except user company) */}
                {!isUserCompany && !isSuggested && (
                  <button
                    onClick={() => onRemove?.(competitor.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                    title="Remove competitor"
                    style={{
                      WebkitTapHighlightColor: "transparent",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Accept/Decline buttons for suggested competitors */}
                {isSuggested && (
                  <>
                    <button
                      onClick={() => onDecline?.(competitor.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                      title="Decline competitor"
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }}
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => onAccept?.(competitor.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                      title="Accept competitor"
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompetitorCard: React.FC<{
  competitor: CompetitorItem;
  index: number;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onEdit?: (competitor: CompetitorItem) => void;
  isEditing?: boolean;
  onSaveEdit?: (id: string, name: string, website: string) => void;
  onCancelEdit?: () => void;
  isUpdating?: boolean;
  isAcceptingOrDeclining?: boolean;
}> = ({
  competitor,
  onAccept,
  onDecline,
  onEdit,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  isUpdating,
  isAcceptingOrDeclining,
}) => {
  const logoResult = competitor.website
    ? getCompanyLogo(competitor.website)
    : null;

  const [editName, setEditName] = React.useState(competitor.name);
  const [editWebsite, setEditWebsite] = React.useState(
    competitor.website || ""
  );

  React.useEffect(() => {
    setEditName(competitor.name);
    setEditWebsite(competitor.website || "");
  }, [competitor.name, competitor.website, isEditing]);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 transition-all p-3 w-full">
      {/* Company Info with Logo */}
      <div className="flex items-start gap-3 mb-1">
        {/* Company Logo */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center">
          {logoResult ? (
            <img
              src={logoResult.url}
              alt={`${competitor.name} logo`}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.setAttribute(
                  "style",
                  "display: flex"
                );
              }}
            />
          ) : null}
          <div
            className="w-full h-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 rounded-lg"
            style={{ display: logoResult ? "none" : "flex" }}
          >
            {competitor.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Company Info - Editable when in edit mode */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2 pb-1 pt-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-2 py-1 text-xs font-medium text-gray-900 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm transition-all"
                placeholder="Company name"
              />
              <input
                type="text"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                className="w-full px-2 py-1 text-xs text-gray-600 bg-gray-50 border-none rounded shadow-inner focus:outline-none focus:bg-white focus:shadow-sm transition-all"
                placeholder="https://company.com"
              />
              <div className="pt-1"></div>
            </div>
          ) : (
            <div className="py-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                {competitor.name}
              </h3>
              <div className="space-y-1">
                {competitor.website && (
                  <a
                    href={
                      competitor.website.startsWith("http")
                        ? competitor.website
                        : `https://${competitor.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">
                      {competitor.website.replace(/^https?:\/\//, "")}
                    </span>
                    <ExternalLink size={10} className="ml-1 flex-shrink-0" />
                  </a>
                )}
                {competitor.mentions !== undefined &&
                  competitor.mentions > 0 && (
                    <span className="text-xs text-gray-500">
                      {competitor.mentions} mention
                      {competitor.mentions !== 1 ? "s" : ""}
                    </span>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Edit button */}
        <div className="flex-shrink-0">
          <button
            onClick={() => onEdit?.(competitor)}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
            title="Edit competitor"
            style={{
              WebkitTapHighlightColor: "transparent",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          >
            <Edit2 size={16} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={() => onCancelEdit?.()}
              disabled={isUpdating}
              className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <X size={12} />
              Cancel
            </button>
            <button
              onClick={() =>
                onSaveEdit?.(competitor.id, editName.trim(), editWebsite.trim())
              }
              disabled={!editName.trim() || !editWebsite.trim() || isUpdating}
              className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check size={12} />
                  Save
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onDecline?.(competitor.id)}
              className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1"
            >
              <X size={12} />
              Decline
            </button>
            <button
              onClick={() => onAccept?.(competitor.id)}
              disabled={isAcceptingOrDeclining}
              className="flex-1 px-3 py-1.5 text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner transition-colors rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAcceptingOrDeclining ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check size={12} />
                  Accept
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const CompetitorsPage = () => {
  const { selectedCompany } = useCompany();
  const { setBreadcrumbs } = useNavigation();
  const {
    data: _dashboardData,
    loading: dashboardLoading,
    hasReport,
  } = useDashboard();

  // Local UI state
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState("");
  const [isAddingCompetitor, setIsAddingCompetitor] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCompetitorId, setEditingCompetitorId] = useState<string | null>(
    null
  );
  const [isUpdatingCompetitor, setIsUpdatingCompetitor] = useState(false);
  const [acceptingDeclineingId, setAcceptingDeclineingId] = useState<
    string | null
  >(null);

  // Local optimistic list to ensure immediate UI updates
  const [localCompetitors, setLocalCompetitors] = useState<
    CompetitorItem[] | null
  >(null);

  // Cache-aware data fetching with 15 minute expiry
  const competitorsCache = usePageCache<CompetitorItem[]>({
    fetcher: useCallback(
      async (ctx?: { signal?: AbortSignal }): Promise<CompetitorItem[]> => {
        if (!selectedCompany?.id) {
          console.log(
            "[CompetitorsPage] No company selected, returning empty array"
          );
          return [];
        }

        console.log(
          "[CompetitorsPage] Fetching competitors data for company:",
          selectedCompany.id
        );

        // Always add user's company first
        const allCompetitors: CompetitorItem[] = [
          {
            id: selectedCompany.id,
            name: selectedCompany.name,
            website: selectedCompany.website || undefined,
            isGenerated: false,
            isAccepted: true,
            status: "user-company",
          },
        ];

        try {
          // Fetch both accepted and suggested competitors
          const [acceptedData, suggestedData] = await Promise.all([
            getAcceptedCompetitors(selectedCompany.id, {
              signal: ctx?.signal,
            }).catch(() => ({ competitors: [] })),
            getSuggestedCompetitors(selectedCompany.id, {
              signal: ctx?.signal,
            }).catch(() => ({ competitors: [] })),
          ]);

          // Add accepted competitors (excluding user's company if it appears in the API response)
          const acceptedCompetitors = (acceptedData.competitors || [])
            .filter((comp) => comp.id !== selectedCompany.id)
            .map((comp) => ({ ...comp, status: "accepted" as const }));
          allCompetitors.push(...acceptedCompetitors);

          // Add suggested competitors sorted by mentions (descending)
          const suggestedCompetitors = (suggestedData.competitors || [])
            .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
            .map((comp) => ({ ...comp, status: "suggested" as const }));
          allCompetitors.push(...suggestedCompetitors);

          console.log(
            `[CompetitorsPage] Loaded ${allCompetitors.length} total competitors`
          );
          return allCompetitors;
        } catch (error) {
          console.error("[CompetitorsPage] Failed to load competitors:", error);
          // Return just user's company on error
          return allCompetitors;
        }
      },
      [selectedCompany]
    ),
    pageType: "competitors",
    companyId: selectedCompany?.id || "",
    enabled: !!selectedCompany?.id,
    staleWhileRevalidate: true,
    onDataLoaded: useCallback((data, isFromCache) => {
      console.log(
        `[CompetitorsPage] Data loaded ${isFromCache ? "from cache" : "fresh"}: ${data.length} competitors`
      );
    }, []),
    onError: useCallback((error) => {
      console.error("[CompetitorsPage] Cache fetch error:", error);
    }, []),
  });

  // Keep local list in sync with cache
  useEffect(() => {
    setLocalCompetitors(competitorsCache.data || null);
  }, [competitorsCache.data]);

  // Prefer local optimistic data
  const competitors = useMemo(() => {
    return (localCompetitors ??
      competitorsCache.data ??
      []) as CompetitorItem[];
  }, [localCompetitors, competitorsCache.data]);
  const isLoading = competitors.length === 0 && competitorsCache.loading;

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
    setBreadcrumbs([{ label: "AI Performance" }, { label: "Competitors" }]);
  }, [setBreadcrumbs]);

  const handleAcceptCompetitor = useCallback(
    async (competitorId: string) => {
      if (!selectedCompany?.id) return;

      setAcceptingDeclineingId(competitorId);
      try {
        await acceptCompetitor(selectedCompany.id, competitorId);

        // Optimistically update local list
        const base = (localCompetitors ??
          competitorsCache.data ??
          []) as CompetitorItem[];
        const updatedCompetitors = base.map((comp) =>
          comp.id === competitorId
            ? { ...comp, status: "accepted" as const }
            : comp
        );

        setLocalCompetitors(updatedCompetitors);
        competitorsCache.setData(updatedCompetitors);
        // Explicitly invalidate accepted-competitors shared cache so other pages refresh too
        // and ensure suggested list drops the item on next recompute
        import("../utils/pageCache").then(({ invalidateCache }) =>
          invalidateCache("accepted-competitors", selectedCompany.id)
        );
        // Revalidate in background
        void competitorsCache.refresh();
      } catch (error) {
        console.error("Failed to accept competitor:", error);
        // Invalidate cache to reload fresh data on error
        competitorsCache.invalidate();
      } finally {
        setAcceptingDeclineingId(null);
      }
    },
    [selectedCompany?.id, competitorsCache, localCompetitors]
  );

  const handleDeclineCompetitor = useCallback(
    async (competitorId: string) => {
      if (!selectedCompany?.id) return;

      setAcceptingDeclineingId(competitorId);
      try {
        await declineCompetitor(selectedCompany.id, competitorId);

        // Optimistically update local list
        const base = (localCompetitors ??
          competitorsCache.data ??
          []) as CompetitorItem[];
        const updatedCompetitors = base.filter(
          (comp) => comp.id !== competitorId
        );
        setLocalCompetitors(updatedCompetitors);
        competitorsCache.setData(updatedCompetitors);
        import("../utils/pageCache").then(({ invalidateCache }) =>
          invalidateCache("accepted-competitors", selectedCompany.id)
        );
        void competitorsCache.refresh();
      } catch (error) {
        console.error("Failed to decline competitor:", error);
        // Invalidate cache to reload fresh data on error
        competitorsCache.invalidate();
      } finally {
        setAcceptingDeclineingId(null);
      }
    },
    [selectedCompany?.id, competitorsCache, localCompetitors]
  );

  const handleAddCompetitor = useCallback(async () => {
    if (
      !newCompetitorName.trim() ||
      !newCompetitorWebsite.trim() ||
      !selectedCompany?.id
    )
      return;

    setIsAddingCompetitor(true);
    try {
      const newCompetitor = await addCompetitor(selectedCompany.id, {
        name: newCompetitorName.trim(),
        website: newCompetitorWebsite.trim(),
      });

      // Optimistically append
      const base = (localCompetitors ??
        competitorsCache.data ??
        []) as CompetitorItem[];
      const updatedCompetitors = [
        ...base,
        { ...newCompetitor, status: "accepted" as const },
      ];
      setLocalCompetitors(updatedCompetitors);
      competitorsCache.setData(updatedCompetitors);

      setNewCompetitorName("");
      setNewCompetitorWebsite("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to add competitor:", error);
      // Invalidate cache to reload fresh data on error
      competitorsCache.invalidate();
    } finally {
      setIsAddingCompetitor(false);
    }
  }, [
    selectedCompany?.id,
    newCompetitorName,
    newCompetitorWebsite,
    competitorsCache,
    localCompetitors,
  ]);

  const handleEditCompetitor = (competitor: CompetitorItem) => {
    setEditingCompetitorId(competitor.id);
  };

  const handleSaveEdit = useCallback(
    async (competitorId: string, name: string, website: string) => {
      if (!name.trim() || !website.trim() || !selectedCompany?.id) return;

      setIsUpdatingCompetitor(true);
      try {
        await updateCompetitor(selectedCompany.id, competitorId, {
          name: name.trim(),
          website: website.trim(),
        });

        const base = (localCompetitors ??
          competitorsCache.data ??
          []) as CompetitorItem[];
        const updatedCompetitors = base.map((comp) =>
          comp.id === competitorId
            ? { ...comp, name: name.trim(), website: website.trim() }
            : comp
        );
        setLocalCompetitors(updatedCompetitors);
        competitorsCache.setData(updatedCompetitors);

        setEditingCompetitorId(null);
      } catch (error) {
        console.error("Failed to update competitor:", error);
        alert("Failed to update competitor. Please try again.");
        // Invalidate cache to reload fresh data on error
        competitorsCache.invalidate();
      } finally {
        setIsUpdatingCompetitor(false);
      }
    },
    [selectedCompany?.id, competitorsCache, localCompetitors]
  );

  const handleCancelEdit = () => {
    setEditingCompetitorId(null);
  };

  const handleRemoveCompetitor = useCallback(
    async (competitorId: string) => {
      if (!selectedCompany?.id) return;

      try {
        await deleteCompetitor(selectedCompany.id, competitorId);

        const base = (localCompetitors ??
          competitorsCache.data ??
          []) as CompetitorItem[];
        const updatedCompetitors = base.filter(
          (comp) => comp.id !== competitorId
        );
        setLocalCompetitors(updatedCompetitors);
        competitorsCache.setData(updatedCompetitors);
      } catch (error) {
        console.error("Failed to remove competitor:", error);
        alert("Failed to remove competitor. Please try again.");
        // Invalidate cache to reload fresh data on error
        competitorsCache.invalidate();
      }
    },
    [selectedCompany?.id, competitorsCache, localCompetitors]
  );

  // Separate competitors by status for display - memoized to prevent unnecessary recalculations
  const categorizedCompetitors = useMemo(() => {
    const userCompany = competitors.filter((c) => c.status === "user-company");
    const accepted = competitors.filter((c) => c.status === "accepted");
    const suggested = competitors.filter((c) => c.status === "suggested");

    // Only show the top 4 suggested competitors (already sorted by mentions)
    const displayedSuggested = suggested.slice(0, 4);

    return {
      userCompany,
      acceptedCompetitors: accepted,
      suggestedCompetitors: suggested,
      displayedSuggested,
    };
  }, [competitors]);

  const {
    userCompany,
    acceptedCompetitors,
    suggestedCompetitors,
    displayedSuggested,
  } = categorizedCompetitors;

  // Debug condition state (only log when conditions change)
  useEffect(() => {
    console.log("[CompetitorsPage] Render condition check:", {
      dashboardLoading,
      hasReport,
      condition1: hasReport === null,
      condition2: !hasReport,
      shouldShowDashboardLoading: hasReport === null,
      shouldShowWelcome: !hasReport && hasReport !== null,
    });
  }, [dashboardLoading, hasReport]);

  return (
    <div className="h-full flex flex-col">
      {/* Show dashboard loading only if we can't determine report status */}
      {hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : (
        <div className="h-full relative">
          {/* Welcome prompt overlay - shown over competitors if no report */}
          {!hasReport && (
            <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-center">
              <div className="w-full max-w-2xl">
                <WelcomePrompt
                  onGenerateReport={generateReport}
                  isGenerating={isGenerating}
                  generationStatus={generationStatus}
                  progress={progress}
                  isButtonDisabled={isButtonDisabled}
                  generationState={generationState}
                />
              </div>
            </div>
          )}

          {/* Competitors content - always rendered to ensure stable mounting */}
          <div className="h-full flex flex-col">
            {/* Content */}
            {isLoading ? (
              <BlankLoadingState message="Loading competitors..." />
            ) : (
              <div className="flex-1 min-h-0 p-1">
                <div className="h-full w-full flex flex-col">
                  {/* Suggested Competitors Section - At top */}
                  {displayedSuggested.length > 0 && (
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
                          {displayedSuggested.map((competitor, index) => (
                            <CompetitorCard
                              key={competitor.id}
                              competitor={competitor}
                              index={index}
                              onAccept={handleAcceptCompetitor}
                              onDecline={handleDeclineCompetitor}
                              onEdit={handleEditCompetitor}
                              isEditing={editingCompetitorId === competitor.id}
                              onSaveEdit={handleSaveEdit}
                              onCancelEdit={handleCancelEdit}
                              isUpdating={
                                isUpdatingCompetitor &&
                                editingCompetitorId === competitor.id
                              }
                              isAcceptingOrDeclining={
                                acceptingDeclineingId === competitor.id
                              }
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
                            ({userCompany.length + acceptedCompetitors.length})
                          </span>
                        </h2>
                        <button
                          onClick={() => setShowAddForm(!showAddForm)}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          <Plus size={12} />
                          Add Competitor
                        </button>
                      </div>

                      {/* Add Competitor Form */}
                      {showAddForm && (
                        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Company Name
                              </label>
                              <input
                                type="text"
                                value={newCompetitorName}
                                onChange={(e) =>
                                  setNewCompetitorName(e.target.value)
                                }
                                placeholder="Enter company name"
                                className="w-full px-2 py-1.5 border border-gray-200 rounded shadow-sm focus:ring-1 focus:ring-blue-600 focus:border-transparent text-xs"
                              />
                            </div>
                            <div className="flex gap-3 items-end">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Website URL
                                </label>
                                <input
                                  type="text"
                                  value={newCompetitorWebsite}
                                  onChange={(e) =>
                                    setNewCompetitorWebsite(e.target.value)
                                  }
                                  placeholder="company.com"
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded shadow-sm focus:ring-1 focus:ring-blue-600 focus:border-transparent text-xs"
                                />
                              </div>
                              <button
                                onClick={handleAddCompetitor}
                                disabled={
                                  !newCompetitorName.trim() ||
                                  !newCompetitorWebsite.trim() ||
                                  isAddingCompetitor
                                }
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-800 hover:text-gray-900 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Add competitor"
                                style={{
                                  WebkitTapHighlightColor: "transparent",
                                  WebkitUserSelect: "none",
                                  userSelect: "none",
                                }}
                              >
                                {isAddingCompetitor ? (
                                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-4">
                        {userCompany.length === 0 &&
                        acceptedCompetitors.length === 0 ? (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-center">
                              <Users
                                size={32}
                                className="mx-auto text-gray-300 mb-2"
                              />
                              <p className="text-gray-500">
                                No competitors added yet
                              </p>
                              <p className="text-gray-400 text-sm mt-1">
                                Add competitors manually or accept suggestions
                                above
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* User Company */}
                            {userCompany.map((competitor, index) => (
                              <CompetitorListItem
                                key={competitor.id}
                                competitor={competitor}
                                index={index}
                                onEdit={handleEditCompetitor}
                                onRemove={handleRemoveCompetitor}
                                isEditing={
                                  editingCompetitorId === competitor.id
                                }
                                onSaveEdit={handleSaveEdit}
                                onCancelEdit={handleCancelEdit}
                                isUpdating={
                                  isUpdatingCompetitor &&
                                  editingCompetitorId === competitor.id
                                }
                              />
                            ))}

                            {/* Accepted Competitors */}
                            {acceptedCompetitors.map((competitor, index) => (
                              <CompetitorListItem
                                key={competitor.id}
                                competitor={competitor}
                                index={userCompany.length + index}
                                onEdit={handleEditCompetitor}
                                onRemove={handleRemoveCompetitor}
                                isEditing={
                                  editingCompetitorId === competitor.id
                                }
                                onSaveEdit={handleSaveEdit}
                                onCancelEdit={handleCancelEdit}
                                isUpdating={
                                  isUpdatingCompetitor &&
                                  editingCompetitorId === competitor.id
                                }
                              />
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitorsPage;
