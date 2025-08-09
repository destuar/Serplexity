import React from "react";

type Primitive = string | number | boolean | null | undefined;

interface StructuredObjectViewProps {
  data: unknown;
  title?: string;
}

const KeyLabel: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center rounded-sm bg-gray-100/70 text-gray-800 border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium">
    {label}
  </span>
);

const ValueBadge: React.FC<{ value: Primitive }> = ({ value }) => {
  const text =
    value === null
      ? "null"
      : value === undefined
        ? "—"
        : typeof value === "boolean"
          ? value
            ? "true"
            : "false"
          : String(value);
  return (
    <span className="inline-flex items-center rounded-md bg-white/70 border border-white/30 px-1.5 py-0.5 text-[11px] text-gray-800">
      {text || "—"}
    </span>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white/70 backdrop-blur-sm border border-white/30 rounded-lg p-2.5">
    <div className="text-xs font-semibold text-gray-900 mb-1.5">{title}</div>
    {children}
  </div>
);

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    value === undefined ||
    ["string", "number", "boolean"].includes(typeof value)
  );
}

const StructuredObjectView: React.FC<StructuredObjectViewProps> = ({
  data,
  title,
}) => {
  if (data == null) return null;

  const renderValue = (val: unknown, keyHint?: string): React.ReactNode => {
    if (isPrimitive(val)) return <ValueBadge value={val} />;

    if (Array.isArray(val)) {
      if (val.length === 0)
        return <span className="text-[11px] text-gray-500">(empty)</span>;
      return (
        <div className="space-y-1">
          {val.slice(0, 20).map((item, idx) => (
            <div key={`${keyHint}-${idx}`} className="flex items-start gap-2">
              <KeyLabel label={`#${idx + 1}`} />
              <div className="flex-1">
                {renderValue(item, `${keyHint}-${idx}`)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof val === "object" && val) {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0)
        return <span className="text-[11px] text-gray-500">(empty)</span>;
      return (
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={`${keyHint}-${k}`} className="flex items-start gap-2">
              <KeyLabel label={k} />
              <div className="flex-1">{renderValue(v, `${keyHint}-${k}`)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <ValueBadge value={String(val)} />;
  };

  return (
    <div className="space-y-2">
      {title && (
        <div className="text-sm font-semibold text-gray-900">{title}</div>
      )}
      <Section title="Details">{renderValue(data, title || "root")}</Section>
    </div>
  );
};

export default StructuredObjectView;
