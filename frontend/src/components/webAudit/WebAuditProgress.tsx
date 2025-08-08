/**
 * @file WebAuditProgress.tsx
 * @description Component for showing audit progress and real-time updates
 *
 * Displays progress bar, current analysis step, and estimated completion time.
 * Polls the backend for status updates and handles completion/error states.
 */

import type { AxiosError } from "axios";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Gauge,
  Loader2,
  Search,
  Shield,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../lib/apiClient";
import { AuditConfig, AuditResult } from "../../pages/WebAuditPage";
import { InlineSpinner } from "../ui/InlineSpinner";

interface WebAuditProgressProps {
  auditId: string;
  config: AuditConfig;
  onComplete: (result: AuditResult) => void;
  onError: () => void;
}

const WebAuditProgress: React.FC<WebAuditProgressProps> = ({
  auditId,
  config,
  onComplete,
  onError,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing audit...");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const nextDelayRef = useRef<number>(3000);

  const analysisSteps = [
    {
      key: "performance",
      label: "Performance Analysis",
      description: "Analyzing Core Web Vitals and load times",
      icon: Gauge,
      color: "orange",
      enabled: config.includePerformance,
    },
    {
      key: "seo",
      label: "SEO Analysis",
      description: "Checking technical SEO and meta tags",
      icon: Search,
      color: "green",
      enabled: config.includeSEO,
    },
    {
      key: "geo",
      label: "AI Search Analysis",
      description: "Analyzing AI optimization factors",
      icon: Sparkles,
      color: "purple",
      enabled: config.includeGEO,
    },
    {
      key: "accessibility",
      label: "Accessibility Analysis",
      description: "Checking WCAG compliance",
      icon: Eye,
      color: "blue",
      enabled: config.includeAccessibility,
    },
    {
      key: "security",
      label: "Security Analysis",
      description: "Scanning for vulnerabilities",
      icon: Shield,
      color: "red",
      enabled: config.includeSecurity,
    },
  ].filter((step) => step.enabled);

  const getCurrentStepIndex = useCallback(
    (progress: number) => {
      if (progress < 10) return -1; // Initializing
      if (progress >= 95) return analysisSteps.length; // Finalizing

      const stepProgress = (progress - 10) / 80; // 10% for init, 10% for finalization
      return Math.floor(stepProgress * analysisSteps.length);
    },
    [analysisSteps.length]
  );

  const pollAuditStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/web-audit/${auditId}/status`);
      const statusInfo = data.data;

      if (statusInfo.status === "completed" && statusInfo.scores) {
        // Audit is complete, fetch full results
        const resultsResponse = await apiClient.get(`/web-audit/${auditId}`);
        onComplete(resultsResponse.data.data);
        return;
      } else if (statusInfo.status === "failed") {
        setError("Audit failed. Please try again.");
        onError();
        return;
      } else {
        // Still running, simulate progress based on elapsed time
        const elapsedSeconds = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );
        const simulatedProgress = Math.min(90, (elapsedSeconds / 120) * 90); // 90% max, 2min expected
        setProgress(simulatedProgress);

        const stepIndex = getCurrentStepIndex(simulatedProgress);
        if (stepIndex >= 0 && stepIndex < analysisSteps.length) {
          setCurrentStep(analysisSteps[stepIndex].description);
        } else if (stepIndex >= analysisSteps.length) {
          setCurrentStep("Finalizing results...");
        }
        nextDelayRef.current = 3000; // reset delay on success
      }
    } catch (error: unknown) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status as number | undefined;
      if (status === 429) {
        // Rate limited: back off, do not surface error
        nextDelayRef.current = Math.min(
          (nextDelayRef.current || 3000) * 2,
          10000
        );
        return;
      }
      if (status === 401 || status === 403 || (status && status >= 500)) {
        // Transient/auth: let interceptors handle refresh; retry shortly
        nextDelayRef.current = 5000;
        return;
      }
      console.error("Error polling audit status:", error);
      setError("Lost connection to audit service");
      onError();
    }
  }, [auditId, analysisSteps, getCurrentStepIndex, onComplete, onError]);

  // Single-loop polling with adaptive backoff
  useEffect(() => {
    let cancelled = false;
    startTimeRef.current = Date.now();
    nextDelayRef.current = 3000;

    const loop = async () => {
      if (cancelled) return;
      await pollAuditStatus();
      if (cancelled) return;
      setTimeout(loop, nextDelayRef.current);
    };
    // Initial tick
    loop();

    return () => {
      cancelled = true;
    };
  }, [auditId, pollAuditStatus]);

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();
    const timeInterval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStepColor = (color: string) => {
    const colors = {
      orange: "bg-orange-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      blue: "bg-blue-500",
      red: "bg-red-500",
    };
    return colors[color as keyof typeof colors] || "bg-gray-500";
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8">
          <div className="text-center space-y-4">
            <div className="p-3 bg-red-100 rounded-full inline-block">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-red-900">Audit Failed</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={onError}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex(progress);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Analyzing Website
                </h2>
                <p className="text-blue-100">{config.url}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-white">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
              <p className="text-blue-100 text-sm">Elapsed time</p>
            </div>
          </div>
        </div>

        {/* Progress Content */}
        <div className="p-8 space-y-8">
          {/* Overall Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Overall Progress
              </h3>
              <span className="text-sm font-medium text-gray-600">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">{currentStep}</p>
          </div>

          {/* Analysis Steps */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Analysis Steps
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {analysisSteps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                // const isPending = index > currentStepIndex;

                const IconComponent = step.icon;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center space-x-4 p-4 rounded-xl border transition-all ${
                      isCompleted
                        ? "bg-green-50 border-green-200"
                        : isCurrent
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isCompleted
                          ? "bg-green-500"
                          : isCurrent
                            ? getStepColor(step.color)
                            : "bg-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <IconComponent
                          className={`w-5 h-5 text-white ${
                            isCurrent ? "animate-pulse" : ""
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {step.label}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {step.description}
                      </p>
                    </div>
                    <div>
                      {isCompleted && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {isCurrent && <InlineSpinner size={20} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estimated Time */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  Estimated Time Remaining
                </p>
                <p className="text-sm text-blue-700">
                  {progress < 90
                    ? `${Math.max(0, 120 - elapsedTime)}s (typical audit takes 2-3 minutes)`
                    : "Almost done, finalizing results..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebAuditProgress;
