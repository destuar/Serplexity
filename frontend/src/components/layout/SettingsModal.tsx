/**
 * @file SettingsModal.tsx
 * @description Modal component for application settings management, including notification preferences, display options, and system configurations.
 * Provides users with control over their application experience and preferences.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../../contexts/AuthContext: For user authentication state.
 * - ../../contexts/CompanyContext: For company data and settings.
 *
 * @exports
 * - SettingsModal: The main settings modal component.
 */
import {
  AlertTriangle,
  CalendarClock,
  HelpCircle,
  Mail,
  Stars,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { InlineSpinner } from "../ui/InlineSpinner";
// Note: buttonClasses and formClasses imports removed as they're unused
// import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from "../../contexts/CompanyContext";
import { useReportGeneration } from "../../hooks/useReportGeneration";
import apiClient from "../../lib/apiClient";
import { MODEL_CONFIGS, getModelDisplayName } from "../../types/dashboard";
import { Button } from "../ui/Button";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState("models");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  // Models state
  const [modelPreferences, setModelPreferences] = useState<
    Record<string, boolean>
  >({
    "gpt-4.1-mini": true,
    "claude-3-5-haiku-20241022": true,
    "gemini-2.5-flash": true,
    sonar: true,
    "ai-overview": true,
  });
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Report schedule state
  type ScheduleMode = "MANUAL" | "DAILY" | "WEEKLY" | "CUSTOM";
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("DAILY");
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Defer conditional return until after hooks to avoid conditional hook execution
  // Report generation hook (used for Manual mode trigger)
  const {
    isGenerating: isReportGenerating,
    generateReport,
    isButtonDisabled,
  } = useReportGeneration(selectedCompany);

  const handleSubmitFeedback = async () => {
    try {
      // In a real app, this would send feedback to your API
      console.log("Submitting feedback:", feedbackText);
      setFeedbackSubmitted(true);
      setFeedbackText("");
      setTimeout(() => setFeedbackSubmitted(false), 3000);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  // Load model preferences on open
  // Load preferences whenever modal is toggled (hook must run unconditionally)
  React.useEffect(() => {
    const load = async () => {
      try {
        if (!selectedCompany?.id) return;
        const response = await apiClient.get(
          `/companies/${selectedCompany.id}/model-preferences`
        );
        setModelPreferences(response.data.modelPreferences);

        // Load report schedule
        const schedRes = await apiClient.get(
          `/companies/${selectedCompany.id}/report-schedule`
        );
        const sched = schedRes.data.schedule as {
          mode: ScheduleMode;
          timezone?: string | null;
          weeklyDays: number[];
          dates: string[];
        };
        setScheduleMode(sched.mode);
        setScheduleTimezone(sched.timezone || scheduleTimezone);
        setWeeklyDays(sched.weeklyDays || []);
        setCustomDates((sched.dates || []).sort());
      } catch (err) {
        console.error("Failed to load model preferences:", err);
      }
    };
    if (isOpen && selectedCompany?.id) {
      void load();
    }
  }, [isOpen, selectedCompany?.id]);

  const handleModelToggle = (modelId: string) => {
    setModelPreferences((prev) => ({ ...prev, [modelId]: !prev[modelId] }));
  };

  const toggleWeeklyDay = (day: number) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const addCustomDate = (dateIso: string) => {
    if (!dateIso) return;
    const norm = dateIso.slice(0, 10);
    setCustomDates((prev) => Array.from(new Set([...prev, norm])).sort());
  };

  const removeCustomDate = (dateIso: string) => {
    setCustomDates((prev) => prev.filter((d) => d !== dateIso));
  };

  const saveSchedule = async () => {
    try {
      if (!selectedCompany?.id) return;
      setIsSavingSchedule(true);
      setScheduleError(null);
      const payload = {
        mode: scheduleMode,
        timezone: scheduleTimezone,
        weeklyDays: scheduleMode === "WEEKLY" ? weeklyDays : [],
        dates: scheduleMode === "CUSTOM" ? customDates : [],
      };
      await apiClient.put(
        `/companies/${selectedCompany.id}/report-schedule`,
        payload
      );
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error
          ? (err as { response?: { data?: { error?: string } } }).response!
              .data!.error!
          : "Failed to save schedule";
      setScheduleError(message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleUpdateModels = async (): Promise<void> => {
    setIsUpdatingModels(true);
    setModelsError(null);
    try {
      if (!selectedCompany?.id) {
        throw new Error("No company selected");
      }
      await apiClient.put(
        `/companies/${selectedCompany.id}/model-preferences`,
        { modelPreferences }
      );
    } catch (err: unknown) {
      const getErrorMessage = (e: unknown): string => {
        if (typeof e === "object" && e !== null) {
          const typed = e as { response?: { data?: { error?: string } } };
          return (
            typed.response?.data?.error || "Failed to update model preferences"
          );
        }
        return "Failed to update model preferences";
      };
      setModelsError(getErrorMessage(err));
    } finally {
      setIsUpdatingModels(false);
    }
  };

  const tabs = [
    { id: "models", label: "Models", icon: Stars },
    { id: "schedule", label: "Report Schedule", icon: CalendarClock },
    { id: "help", label: "Help & Feedback", icon: HelpCircle },
  ];

  // Note: hooks must be declared before any conditional returns
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Workspace Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row h-[calc(95vh-80px)] sm:h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-full sm:w-64 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 p-3 sm:p-4 flex-shrink-0">
            <nav className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto sm:overflow-x-visible">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 sm:w-full flex items-center justify-center sm:justify-start px-3 sm:px-4 py-1.5 sm:py-2 text-left rounded-lg transition-colors focus:outline-none whitespace-nowrap sm:whitespace-normal min-w-[44px] sm:min-w-0 text-xs sm:text-sm ${
                      activeTab === tab.id
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-sm">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === "models" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">
                    AI Model Preferences
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select which AI model responses you'd like to track.
                  </p>
                </div>

                {!selectedCompany && (
                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Select a company to manage settings.
                  </div>
                )}

                <div className="space-y-4">
                  {/* ChatGPT */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["gpt-4.1-mini"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["gpt-4.1-mini"].logoUrl}
                            alt={getModelDisplayName("gpt-4.1-mini")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("gpt-4.1-mini").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getModelDisplayName("gpt-4.1-mini")}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {MODEL_CONFIGS["gpt-4.1-mini"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["gpt-4.1-mini"]}
                        onChange={() => handleModelToggle("gpt-4.1-mini")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-700"></div>
                    </label>
                  </div>

                  {/* Claude */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["claude-3-5-haiku-20241022"]?.logoUrl ? (
                          <img
                            src={
                              MODEL_CONFIGS["claude-3-5-haiku-20241022"].logoUrl
                            }
                            alt={getModelDisplayName(
                              "claude-3-5-haiku-20241022"
                            )}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName(
                              "claude-3-5-haiku-20241022"
                            ).charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getModelDisplayName("claude-3-5-haiku-20241022")}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {MODEL_CONFIGS["claude-3-5-haiku-20241022"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["claude-3-5-haiku-20241022"]}
                        onChange={() =>
                          handleModelToggle("claude-3-5-haiku-20241022")
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-700"></div>
                    </label>
                  </div>

                  {/* Gemini */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["gemini-2.5-flash"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["gemini-2.5-flash"].logoUrl}
                            alt={getModelDisplayName("gemini-2.5-flash")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("gemini-2.5-flash").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getModelDisplayName("gemini-2.5-flash")}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {MODEL_CONFIGS["gemini-2.5-flash"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["gemini-2.5-flash"]}
                        onChange={() => handleModelToggle("gemini-2.5-flash")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-700"></div>
                    </label>
                  </div>

                  {/* Perplexity */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["sonar"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["sonar"].logoUrl}
                            alt={getModelDisplayName("sonar")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("sonar").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getModelDisplayName("sonar")}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {MODEL_CONFIGS["sonar"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["sonar"]}
                        onChange={() => handleModelToggle("sonar")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-700"></div>
                    </label>
                  </div>

                  {/* AI Overviews */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["ai-overview"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["ai-overview"].logoUrl}
                            alt={getModelDisplayName("ai-overview")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("ai-overview").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getModelDisplayName("ai-overview")}
                        </h4>
                        <p className="text-xs text-gray-600">Google</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!modelPreferences["ai-overview"]}
                        onChange={() => handleModelToggle("ai-overview")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-700"></div>
                    </label>
                  </div>
                </div>

                {modelsError && (
                  <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {modelsError}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-8">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateModels}
                    disabled={isUpdatingModels}
                    className="flex items-center gap-2"
                  >
                    {isUpdatingModels && <InlineSpinner size={16} />}
                    {isUpdatingModels ? "" : "Save Preferences"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Report Schedule
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Control how often Serplexity generates reports for this
                    company.
                  </p>
                </div>

                {!selectedCompany && (
                  <div className="p-3 text-sm text-yellow-800 bg-yellow-50 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Select a company to manage schedule.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-gray-700">
                      Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["MANUAL", "DAILY", "WEEKLY", "CUSTOM"] as const).map(
                        (m) => (
                          <button
                            key={m}
                            onClick={() => setScheduleMode(m)}
                            className={`px-3 py-2 rounded-lg border text-sm ${scheduleMode === m ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                          >
                            {m.charAt(0) + m.slice(1).toLowerCase()}
                          </button>
                        )
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Timezone
                      </label>
                      <input
                        value={scheduleTimezone}
                        onChange={(e) => setScheduleTimezone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black/20"
                        placeholder="e.g. America/Los_Angeles"
                      />
                      <p className="text-xs text-gray-500">
                        Use an IANA timezone, defaults to your browser timezone.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {scheduleMode === "WEEKLY" && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Days of week
                        </label>
                        <div className="grid grid-cols-7 gap-2 mt-2">
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((label, idx) => (
                            <button
                              key={label}
                              onClick={() => toggleWeeklyDay(idx)}
                              className={`px-2 py-2 rounded-lg text-sm border ${weeklyDays.includes(idx) ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Reports will run on the selected weekdays.
                        </p>
                      </div>
                    )}

                    {scheduleMode === "CUSTOM" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Specific dates
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            onChange={(e) => addCustomDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        {customDates.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {customDates.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-100 text-sm"
                              >
                                {d}
                                <button
                                  onClick={() => removeCustomDate(d)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Dates are interpreted in the selected timezone.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {scheduleMode === "MANUAL" && selectedCompany && (
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Manual report
                      </p>
                      <p className="text-xs text-gray-600">
                        Run a report on demand when using Manual mode.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={generateReport}
                      disabled={isButtonDisabled}
                      className="flex items-center gap-2"
                    >
                      {isReportGenerating && <InlineSpinner size={16} />}
                      {isReportGenerating ? "" : "Generate Report"}
                    </Button>
                  </div>
                )}

                {scheduleError && (
                  <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {scheduleError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={saveSchedule}
                    disabled={isSavingSchedule}
                    className="flex items-center gap-2"
                  >
                    {isSavingSchedule && <InlineSpinner size={16} />}
                    {isSavingSchedule ? "" : "Save Schedule"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "help" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Help & Feedback
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Get help or send us your feedback to improve Serplexity.
                  </p>
                </div>

                {/* Contact Support */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Contact Support
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Need help with your account or have questions? Reach out to
                    our support team.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open("mailto:support@serplexity.com", "_blank")
                    }
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    support@serplexity.com
                  </Button>
                </div>

                {/* Feedback Form */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Send Feedback
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Help us improve Serplexity by sharing your thoughts and
                    suggestions.
                  </p>

                  {feedbackSubmitted ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800">
                        Thank you for your feedback! We'll review it and get
                        back to you if needed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us what you think about Serplexity, report a bug, or suggest a feature..."
                        className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none"
                      />
                      <Button
                        onClick={handleSubmitFeedback}
                        disabled={!feedbackText.trim()}
                        className="w-full"
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  )}
                </div>

                {/* Resources */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Resources
                  </h4>
                  <div className="space-y-2">
                    <a
                      href="/privacy"
                      className="block text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Privacy Policy
                    </a>
                    <a
                      href="/terms"
                      className="block text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Terms of Service
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* No company editing overlay here anymore */}
      </div>
    </div>
  );
};

export default SettingsModal;
