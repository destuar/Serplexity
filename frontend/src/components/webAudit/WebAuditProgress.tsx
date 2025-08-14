/**
 * @file WebAuditProgress.tsx
 * @description Component for showing audit progress and real-time updates
 *
 * Displays progress bar, current analysis step, and estimated completion time.
 * Polls the backend for status updates and handles completion/error states.
 */

import type { AxiosError } from "axios";
import { AlertCircle, CheckCircle } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../lib/apiClient";
import { AuditConfig, AuditResult } from "../../pages/WebAuditPage";

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
  const [progress, setProgress] = useState<number>(0);
  // No step text; compact UI
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const nextDelayRef = useRef<number>(3000);
  const isCompletedRef = useRef<boolean>(false);
  const lastProgressRef = useRef<number>(0);
  const targetProgressRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastBackendProgressRef = useRef<number | null>(null);
  const lastBackendUpdateAtRef = useRef<number>(Date.now());
  const expectedDurationRef = useRef<number>(
    // Heuristic expected duration in seconds based on included analyses
    (() => {
      let total = 0;
      if (config.includePerformance) total += 70; // PSI + processing
      if (config.includeSEO) total += 30;
      if (config.includeGEO) total += 35;
      if (config.includeAccessibility) total += 25;
      if (config.includeSecurity) total += 30;
      return Math.max(60, total || 90); // sensible minimum
    })()
  );
  // No fake step list; show accurate binary status (running/completed)

  const pollAuditStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/web-audit/${auditId}/status`);
      const statusInfo = data.data;

      if (statusInfo.status === "completed" && statusInfo.scores) {
        // Audit is complete, fetch full results
        const resultsResponse = await apiClient.get(`/web-audit/${auditId}`);
        isCompletedRef.current = true;
        lastProgressRef.current = 100;
        targetProgressRef.current = 100;
        setProgress(100);
        // Briefly show the filled bar before switching views
        setTimeout(() => onComplete(resultsResponse.data.data), 500);
        return;
      } else if (statusInfo.status === "failed") {
        setError("Audit failed. Please try again.");
        onError();
        return;
      } else {
        // Running: blend backend progress with time-based heuristic to avoid early jumps & long stalls
        if (typeof statusInfo.progress === "number") {
          const backend = Math.max(0, Math.min(95, statusInfo.progress));
          if (
            lastBackendProgressRef.current === null ||
            backend !== lastBackendProgressRef.current
          ) {
            lastBackendProgressRef.current = backend;
            lastBackendUpdateAtRef.current = Date.now();
          }

          const elapsedSec = Math.floor(
            (Date.now() - startTimeRef.current) / 1000
          );
          const expected = expectedDurationRef.current;
          const timePct = Math.min(
            92,
            Math.max(0, (elapsedSec / expected) * 92)
          );
          const secondsSinceBackend =
            (Date.now() - lastBackendUpdateAtRef.current) / 1000;

          // If backend progress is stale for >10s, follow time-based baseline with a small cushion
          let blended: number;
          if (secondsSinceBackend > 10) {
            blended = Math.max(timePct + 5, backend);
          } else {
            // Weighted blend so we don't jump or stall
            blended = Math.max(timePct, 0.65 * backend + 0.35 * timePct);
          }

          targetProgressRef.current = Math.max(
            targetProgressRef.current,
            blended
          );
        }
        nextDelayRef.current = 3000; // reset delay on success
      }
    } catch (error: unknown) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status as number | undefined;
      // Handle throttling
      if (status === 429) {
        nextDelayRef.current = Math.min(
          (nextDelayRef.current || 3000) * 2,
          15000
        );
        return;
      }
      // Treat auth/server errors as transient; interceptors may refresh tokens
      if (status === 401 || status === 403 || (status && status >= 500)) {
        nextDelayRef.current = Math.min(
          (nextDelayRef.current || 3000) * 2,
          15000
        );
        return;
      }
      // Network/connection refused or no response: keep UI alive, backoff and retry
      if (!status || axiosErr.code === "ERR_NETWORK") {
        nextDelayRef.current = Math.min(
          (nextDelayRef.current || 3000) * 2,
          15000
        );
        return;
      }
      // Unknown fatal error: surface and bail
      console.error("Error polling audit status:", error);
      setError("Audit status polling failed");
      onError();
    }
  }, [auditId, onComplete, onError]);

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
      if (!isCompletedRef.current) {
        const elapsedSec = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );
        const expected = expectedDurationRef.current;
        const pct = Math.min(92, Math.max(0, (elapsedSec / expected) * 92));
        // Time-based baseline: ensure we never fall below this
        targetProgressRef.current = Math.max(targetProgressRef.current, pct);
      }
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Smooth animation toward target progress (60fps RAF, easing)
  useEffect(() => {
    let cancelled = false;
    const animate = () => {
      if (cancelled) return;
      const current = lastProgressRef.current;
      const target = targetProgressRef.current;
      const delta = target - current;
      if (Math.abs(delta) > 0.1) {
        const step = Math.max(0.15, Math.abs(delta) * 0.05); // smoother ease-out
        const next = current + Math.sign(delta) * step;
        lastProgressRef.current = Math.min(100, Math.max(0, next));
        setProgress(lastProgressRef.current);
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Snap when close
        lastProgressRef.current = target;
        setProgress(target);
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // kept for potential future use to colorize steps
  const _getStepColor = (color: string) => {
    const colors = {
      orange: "bg-orange-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      blue: "bg-blue-500",
      red: "bg-red-500",
    } as const;
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-white/30 backdrop-blur-sm overflow-hidden">
        {/* Compact header */}
        <div className="px-4 py-3 border-b border-white/20 bg-white/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Web Audit</p>
                <p className="text-xs text-gray-600 truncate max-w-[520px]">
                  {config.url}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Elapsed</p>
              <span className="text-xs font-mono text-gray-800">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">Status</p>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-700 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Minimal completion hint */}
          {progress === 100 && (
            <div className="flex items-center gap-2 text-green-700 text-xs">
              <CheckCircle className="w-4 h-4" />
              <span>Audit complete</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebAuditProgress;
