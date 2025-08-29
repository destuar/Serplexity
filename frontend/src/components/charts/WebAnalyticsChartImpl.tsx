import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DataPoint = {
  date: string;
  visitors: number;
  revenue: number;
  sessions: number;
  bounceRate: number;
  conversionRate: number;
  avgSessionDuration: number;
  revenuePerVisitor: number;
  screenPageViews: number;
  avgVisitorsPerDay: number;
};

interface MetricOption {
  key: string;
  label: string;
  color: string;
  type: "line" | "bar";
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: "visitors", label: "Visitors", color: "#2563eb", type: "line" },
  { key: "revenue", label: "Revenue", color: "#60a5fa", type: "bar" },
  { key: "sessions", label: "Sessions", color: "#3b82f6", type: "line" },
  {
    key: "bounceRate",
    label: "Bounce Rate (%)",
    color: "#1e40af",
    type: "line",
  },
  {
    key: "conversionRate",
    label: "Conversion Rate (%)",
    color: "#1e3a8a",
    type: "line",
  },
  {
    key: "avgSessionDuration",
    label: "Avg Session Duration (s)",
    color: "#93c5fd",
    type: "line",
  },
  {
    key: "revenuePerVisitor",
    label: "Revenue/Visitor",
    color: "#bfdbfe",
    type: "line",
  },
  {
    key: "screenPageViews",
    label: "Page Views",
    color: "#0ea5e9",
    type: "bar",
  },
];

function formatValue(value: number, metricKey: string) {
  if (metricKey === "bounceRate") return `${value.toFixed(2)}%`;
  if (metricKey === "conversionRate") return `${value.toFixed(2)}%`;
  if (metricKey === "avgSessionDuration") {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }
  if (metricKey === "revenue") return `$${value.toLocaleString()}`;
  if (metricKey === "revenuePerVisitor") return `$${value.toFixed(2)}`;
  return value.toLocaleString();
}

export default function WebAnalyticsChartImpl({
  timeSeriesData,
  selectedMetrics,
}: {
  timeSeriesData: DataPoint[];
  selectedMetrics: string[];
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minHeight={300}
      debounce={50}
    >
      <ComposedChart
        data={timeSeriesData}
        margin={{ top: 5, right: 35, bottom: 15, left: 20 }}
        onMouseEnter={() => {
          // noop diagnostics in split chunk
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
          tick={{ fontSize: 11, fill: "#64748b", textAnchor: "middle" }}
          tickMargin={0}
          angle={0}
          height={20}
          interval={
            timeSeriesData.length > 15
              ? Math.floor(timeSeriesData.length / 8)
              : 0
          }
          tickFormatter={(date) => {
            const d = new Date(date);
            if (isNaN(d.getTime())) return "";
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis
          yAxisId="left"
          axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={20}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={20}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            fontSize: "12px",
          }}
          formatter={(value: number, name: string) => [
            formatValue(value, name),
            METRIC_OPTIONS.find((opt) => opt.key === name)?.label || name,
          ]}
          labelFormatter={(date) => {
            const d = new Date(date);
            return isNaN(d.getTime()) ? "Invalid Date" : d.toLocaleDateString();
          }}
          cursor={false}
          allowEscapeViewBox={{ x: false, y: false }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none" }}
        />

        {selectedMetrics.map((metricKey, index) => {
          const option = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
          if (!option) return null;
          const yAxisId = index === 0 ? "left" : "right";
          if (index === 1) {
            return (
              <Bar
                key={metricKey}
                dataKey={metricKey}
                fill="#93c5fd"
                fillOpacity={0.8}
                yAxisId={yAxisId}
                name={option.label}
                radius={[2, 2, 0, 0]}
              />
            );
          }
          return null;
        })}

        {selectedMetrics.map((metricKey, index) => {
          const option = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
          if (!option) return null;
          const yAxisId = index === 0 ? "left" : "right";
          if (index === 0) {
            return (
              <Line
                key={metricKey}
                type="monotone"
                dataKey={metricKey}
                stroke="#1e40af"
                strokeWidth={timeSeriesData.length > 1 ? 2 : 0}
                dot={false}
                activeDot={(props: { cx?: number; cy?: number }) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill="#1e40af"
                    strokeWidth={1}
                    stroke="#ffffff"
                  />
                )}
                yAxisId={yAxisId}
                name={option.label}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={600}
              />
            );
          }
          return null;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
