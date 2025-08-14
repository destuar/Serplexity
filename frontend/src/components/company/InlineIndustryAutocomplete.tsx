import React, { useEffect, useMemo, useRef, useState } from "react";

const INDUSTRY_OPTIONS: string[] = [
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture & Farming",
  "Architecture & Construction",
  "Automotive",
  "Banking & Financial Services",
  "Biotechnology",
  "Chemical & Petrochemical",
  "Consulting",
  "Consumer Electronics",
  "Consumer Goods",
  "Cybersecurity",
  "E-commerce & Retail",
  "Education & Training",
  "Energy & Utilities",
  "Entertainment & Media",
  "Environmental Services",
  "Fashion & Apparel",
  "Financial Technology (FinTech)",
  "Food & Beverage",
  "Gaming",
  "Government & Public Sector",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Human Resources",
  "Insurance",
  "Internet & Software",
  "Investment & Asset Management",
  "Legal Services",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Mining & Metals",
  "Non-Profit",
  "Oil & Gas",
  "Pharmaceutical",
  "Professional Services",
  "Real Estate",
  "Renewable Energy",
  "Research & Development",
  "Sports & Recreation",
  "Telecommunications",
  "Transportation & Logistics",
  "Travel & Tourism",
  "Venture Capital & Private Equity",
  "Waste Management",
  "Other",
];

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

const InlineIndustryAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>(value || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize and deduplicate options regardless of token order around '&' or '/'
  const canonicalKeyForIndustry = (label: string): string => {
    const normalized = label
      .toLowerCase()
      .replace(/\band\b/g, "&")
      .replace(/[\/]/g, "&");
    const parts = normalized
      .split("&")
      .map((p) =>
        p
          .trim()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .replace(/\s+/g, " ")
      )
      .filter(Boolean)
      .sort();
    if (parts.length === 0) return normalized.replace(/\s+/g, " ").trim();
    return parts.join("|");
  };

  useEffect(() => {
    setInput(value || "");
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const makeUnique = (options: string[]): string[] => {
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const opt of options) {
        const key = canonicalKeyForIndustry(opt);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(opt);
        }
      }
      return unique;
    };

    if (!input) return makeUnique(INDUSTRY_OPTIONS);
    const q = input.toLowerCase();
    return makeUnique(
      INDUSTRY_OPTIONS.filter((opt) => opt.toLowerCase().includes(q))
    );
  }, [input]);

  return (
    <div className="relative" style={{ zIndex: 10 }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 shadow-inner rounded-lg focus:outline-none"
        placeholder={placeholder || "Industry (e.g., SaaS, Ecommerce)"}
        autoComplete="off"
      />
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setInput(opt);
                  setOpen(false);
                  setTimeout(() => inputRef.current?.blur(), 0);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No matches. Press Enter to use "{input}".
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InlineIndustryAutocomplete;
