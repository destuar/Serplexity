import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColorArrays } from "../../utils/colorClasses";
import { InlineSpinner } from "../ui/InlineSpinner";
import LiquidGlassCard from "../ui/LiquidGlassCard";

type SeriesPointBase = {
  id: string;
  date: number | string;
  overall: number | null;
  performance: number | null;
  seo: number | null;
  geo: number | null;
  security: number | null;
};

type SeriesPoint = SeriesPointBase & { isZeroPoint?: boolean };

type AuditHistoryItem = {
  id: string;
  url: string;
  status: string;
  requestedAt: string | Date;
  completedAt: string | Date | null;
  scores: {
    performance: number | null;
    seo: number | null;
    geo: number | null;
    accessibility: number | null;
    security: number | null;
    overall: number | null;
  };
};

interface WebAuditScoreOverTimeCardProps {
  history: AuditHistoryItem[];
  dateRange?: "24h" | "7d" | "30d" | "90d" | "1y";
  minHeight?: number;
  loading?: boolean;
}

const WebAuditScoreOverTimeCard: React.FC<WebAuditScoreOverTimeCardProps> = ({
  history,
  dateRange,
  minHeight,
  loading = false,
}) => {
  const [showComponents, setShowComponents] = useState<boolean>(false);
  const [granularity, setGranularity] = useState<"hour" | "day" | "week">(
    dateRange === "24h"
      ? "hour"
      : dateRange === "90d" || dateRange === "1y"
        ? "week"
        : "day"
  );
  const [granularityOpen, setGranularityOpen] = useState<boolean>(false);
  const granularityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        granularityRef.current &&
        !granularityRef.current.contains(e.target as Node)
      ) {
        setGranularityOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groupKeyForWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  };

  // Label formatters per granularity
  const formatHourLabel = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDayLabel = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    });

  const formatWeekLabelFromKey = (weekKey: string) => {
    // weekKey is YYYY-MM-DD (Monday)
    const d = new Date(weekKey);
    return `Week of ${d.toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    })}`;
  };

  const dayKey = (d: Date) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const rawSeries = useMemo<SeriesPoint[]>(() => {
    const items = (history || [])
      .filter((h) => h.status === "completed")
      .slice()
      .reverse(); // oldest to newest

    const base = items.map((h) => ({
      id: h.id,
      // store precise timestamp; we'll format into labels later per granularity
      date: new Date(h.completedAt || h.requestedAt).getTime(),
      overall: h.scores.overall ?? null,
      performance: h.scores.performance ?? null,
      seo: h.scores.seo ?? null,
      geo: h.scores.geo ?? null,
      security: h.scores.security ?? null,
    }));

    if (base.length > 0) {
      const zeroPoint = {
        id: "zero",
        date: "",
        overall: 0,
        performance: 0,
        seo: 0,
        geo: 0,
        security: 0,
        isZeroPoint: true,
      } as const;
      return [zeroPoint as unknown as SeriesPoint, ...base];
    }

    return base;
  }, [history]);

  const chartData = useMemo<SeriesPoint[]>(() => {
    // Helper to prepend a zero point for nicer area baseline
    const withZeroPoint = (series: SeriesPoint[]) => {
      if (series.length === 0) return series;
      const zero = {
        ...series[0],
        date: "",
        isZeroPoint: true,
      } as SeriesPoint;
      zero.overall = 0;
      zero.performance = 0;
      zero.seo = 0;
      zero.geo = 0;
      zero.security = 0;
      return [zero, ...series];
    };

    // Hourly: show distinct runs, no grouping. Format label as HH:mm
    if (granularity === "hour") {
      const series: SeriesPoint[] = rawSeries
        .filter((p) => !p.isZeroPoint)
        .map((p) => ({
          ...p,
          date: typeof p.date === "number" ? formatHourLabel(p.date) : p.date,
        }));
      return withZeroPoint(series);
    }

    // Daily: roll up to one point per calendar day (keep latest), label as M/D
    if (granularity === "day") {
      const groups = new Map<string, SeriesPoint>();
      rawSeries.forEach((pt) => {
        if (pt.isZeroPoint) return;
        const key = dayKey(new Date((pt.date as number) || Date.now()));
        groups.set(key, pt); // overwrite to keep latest in that day
      });
      const series: SeriesPoint[] = Array.from(groups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, v]) => ({
          ...v,
          date: formatDayLabel(new Date(key).getTime()),
        }));
      return withZeroPoint(series);
    }

    // Weekly: group by Monday key; keep last point in each week; label as Week of M/D
    const groups = new Map<string, SeriesPoint>();
    rawSeries.forEach((pt) => {
      if (pt.isZeroPoint) return;
      const key = groupKeyForWeek(new Date((pt.date as number) || Date.now()));
      groups.set(key, pt);
    });
    const series: SeriesPoint[] = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        ...v,
        date: formatWeekLabelFromKey(key),
      }));
    return withZeroPoint(series);
  }, [rawSeries, granularity]);

  const hasData = chartData.length > 0;

  const currentValue = useMemo(() => {
    const real = chartData.filter(
      (p: SeriesPoint) => !p.isZeroPoint && typeof p.overall === "number"
    );
    if (real.length === 0) return null;
    return real[real.length - 1].overall as number;
  }, [chartData]);

  const changeValue = useMemo(() => {
    const real = chartData.filter(
      (p: SeriesPoint) => !p.isZeroPoint && typeof p.overall === "number"
    );
    if (real.length < 2) return null;
    const prev = real[real.length - 2].overall as number;
    const curr = real[real.length - 1].overall as number;
    return curr - prev;
  }, [chartData]);

  return (
    <LiquidGlassCard className="h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">
            Visibility Score
          </h3>
          {typeof currentValue === "number" && (
            <div className="h-8 px-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {currentValue.toFixed(0)}/100
              </span>
            </div>
          )}
          {typeof changeValue === "number" && Math.abs(changeValue) >= 0.1 && (
            <span
              className={`flex items-center text-xs font-medium ${changeValue > 0 ? "text-green-500" : changeValue < 0 ? "text-red-500" : "text-gray-400"}`}
            >
              {changeValue > 0 ? (
                <ChevronUp className="h-3 w-3 mr-0.5" />
              ) : (
                <ChevronDown className="h-3 w-3 mr-0.5" />
              )}
              {Math.abs(changeValue).toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Breakdown toggle */}
          <button
            onClick={() => setShowComponents((v) => !v)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
              showComponents
                ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85"
            }`}
            title={
              showComponents
                ? "Show aggregated view"
                : "Break down by component"
            }
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* Granularity selector (to the right of breakdown) */}
          <div className="relative" ref={granularityRef}>
            <button
              onClick={() => setGranularityOpen((v) => !v)}
              className="flex items-center justify-center w-16 h-8 px-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-xs transition-colors hover:bg-white/85 focus:outline-none select-none"
              title="Time granularity"
            >
              <span className="text-xs">
                {granularity === "day"
                  ? "Daily"
                  : granularity === "week"
                    ? "Weekly"
                    : "Hourly"}
              </span>
            </button>
            {granularityOpen && (
              <div className="absolute top-full left-0 w-full min-w-20 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md z-50 py-1">
                {[
                  { value: "hour", label: "Hourly" },
                  { value: "day", label: "Daily" },
                  { value: "week", label: "Weekly" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setGranularity(opt.value as "hour" | "day" | "week");
                      setGranularityOpen(false);
                    }}
                    className="w-full px-2 py-2 text-left text-xs hover:bg-white/20 transition-colors flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {granularity === opt.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <InlineSpinner size={24} />
        </div>
      ) : !hasData ? (
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          No completed audits yet.
        </div>
      ) : (
        <div className="h-full" style={{ minHeight: minHeight ?? 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 5,
                right: showComponents ? 35 : 15,
                bottom: 0,
                left: 20,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                strokeWidth={1}
                horizontalPoints={[0]}
              />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                allowDecimals={false}
                axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => `${v}`}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  fontSize: 12,
                }}
                content={(props) => {
                  if (
                    !props.active ||
                    !props.payload ||
                    props.payload.length === 0
                  )
                    return null;

                  // Don't show tooltip for zero points
                  if (props.payload[0]?.payload?.isZeroPoint) {
                    return null;
                  }

                  const label = props.label;

                  if (showComponents) {
                    // For breakdown mode, show all components sorted by value (highest to lowest)
                    const payload = props.payload.filter(
                      (entry) =>
                        entry.value !== null && entry.value !== undefined
                    );

                    if (payload.length === 0) return null;

                    // Sort payload by value in descending order
                    const sortedPayload = [...payload].sort((a, b) => {
                      const valueA = typeof a.value === "number" ? a.value : 0;
                      const valueB = typeof b.value === "number" ? b.value : 0;
                      return valueB - valueA;
                    });

                    return (
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          fontSize: "12px",
                          padding: "8px",
                        }}
                      >
                        <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
                          {label && `Date: ${label}`}
                        </p>
                        {sortedPayload.map((entry, index) => (
                          <p
                            key={index}
                            style={{
                              margin:
                                index === sortedPayload.length - 1
                                  ? 0
                                  : "0 0 2px 0",
                              color: entry.color || entry.stroke || "#2563eb",
                            }}
                          >
                            {entry.name || entry.dataKey}:{" "}
                            {typeof entry.value === "number"
                              ? entry.value.toFixed(0)
                              : "0"}
                          </p>
                        ))}
                      </div>
                    );
                  } else {
                    // For single line mode
                    const data = props.payload[0];
                    const value = data.value;
                    const color = data.color || data.stroke || "#2563eb";

                    return (
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          fontSize: "12px",
                          padding: "8px",
                        }}
                      >
                        <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
                          {label && `Date: ${label}`}
                        </p>
                        <p style={{ margin: 0, color: color }}>
                          Overall:{" "}
                          {typeof value === "number" ? value.toFixed(0) : "0"}
                        </p>
                      </div>
                    );
                  }
                }}
                cursor={false}
                allowEscapeViewBox={{ x: false, y: false }}
                shared={showComponents}
                trigger="hover"
                isAnimationActive={false}
                wrapperStyle={{ outline: "none" }}
              />

              {showComponents ? (
                <>
                  {/* Performance */}
                  <Area
                    type="monotone"
                    dataKey="performance"
                    name="Performance"
                    stroke={chartColorArrays.multiColor[0]}
                    fill={chartColorArrays.multiColor[0]}
                    fillOpacity={0.1}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={false}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { isZeroPoint?: boolean };
                    }) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={chartColorArrays.multiColor[0]}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls
                    isAnimationActive
                  />
                  {/* SEO */}
                  <Area
                    type="monotone"
                    dataKey="seo"
                    name="SEO"
                    stroke={chartColorArrays.multiColor[1]}
                    fill={chartColorArrays.multiColor[1]}
                    fillOpacity={0.12}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={false}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { isZeroPoint?: boolean };
                    }) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={chartColorArrays.multiColor[1]}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls
                    isAnimationActive
                  />
                  {/* AI Search (formerly GEO) */}
                  <Area
                    type="monotone"
                    dataKey="geo"
                    name="AI Search"
                    stroke={chartColorArrays.multiColor[2]}
                    fill={chartColorArrays.multiColor[2]}
                    fillOpacity={0.12}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={false}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { isZeroPoint?: boolean };
                    }) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={chartColorArrays.multiColor[2]}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls
                    isAnimationActive
                  />
                  {/* Security */}
                  <Area
                    type="monotone"
                    dataKey="security"
                    name="Security"
                    stroke={chartColorArrays.multiColor[3]}
                    fill={chartColorArrays.multiColor[3]}
                    fillOpacity={0.12}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={false}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { isZeroPoint?: boolean };
                    }) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={chartColorArrays.multiColor[3]}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls
                    isAnimationActive
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.1}
                  strokeWidth={chartData.length > 1 ? 2 : 0}
                  dot={false}
                  activeDot={(props: {
                    cx?: number;
                    cy?: number;
                    payload?: { isZeroPoint?: boolean };
                  }) => {
                    if (props.payload?.isZeroPoint) return <g />;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={5}
                        fill="#2563eb"
                        strokeWidth={0}
                      />
                    );
                  }}
                  connectNulls
                  isAnimationActive
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </LiquidGlassCard>
  );
};

export default WebAuditScoreOverTimeCard;
