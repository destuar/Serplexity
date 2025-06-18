import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Card from "../ui/Card";

const data = [
  { x: 20, y: 15, z: 200, color: "#84cc16" }, // lime-500
  { x: 40, y: 42, z: 450, color: "#a855f7" }, // purple-500
  { x: 70, y: 55, z: 800, color: "#3b82f6" }, // blue-500
  { x: 90, y: 25, z: 300, color: "#f97316" }, // orange-500
];

const SourceChangesCard = () => {
  return (
    <Card className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Source Changes
      </h2>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{
              top: 10,
              right: 15,
              bottom: 40,
              left: 30,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey="x"
              name="Mentions Changes"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              label={{
                value: "Mentions Changes",
                position: "insideBottom",
                offset: -5,
                style: { textAnchor: "middle", fill: "#6b7280", fontSize: "11px" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Mentions"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              label={{
                value: "Mentions",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fill: "#6b7280", fontSize: "11px" },
              }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="size" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: "12px",
              }}
            />
            <Scatter name="Sources" data={data}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default SourceChangesCard; 