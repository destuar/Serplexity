import React, { useEffect, useMemo, useRef, useState } from "react";

// Comprehensive timezone options with proper coverage
const TIMEZONE_OPTIONS: string[] = [
  "UTC",
  // Americas
  "America/New_York",
  "America/Chicago", 
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Toronto",
  "America/Vancouver",
  "America/Halifax",
  "America/St_Johns",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Santiago",
  "America/Caracas",
  "America/Montevideo",
  "America/La_Paz",
  "Pacific/Honolulu",
  "Pacific/Marquesas",
  // Europe
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Warsaw",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Athens",
  "Europe/Bucharest",
  "Europe/Sofia",
  "Europe/Kiev",
  "Europe/Minsk",
  // Asia
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Taipei",
  "Asia/Kuala_Lumpur",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Mumbai",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Kabul",
  "Asia/Tashkent",
  "Asia/Almaty",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
  "Asia/Magadan",
  "Asia/Kamchatka",
  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Algiers",
  // Australia & Pacific
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Chatham",
  "Pacific/Samoa",
  "Pacific/Tahiti",
  "Pacific/Guam",
];

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

const InlineTimezoneAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>(value || "");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isValidTimezone, setIsValidTimezone] = useState<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value || "");
    // Validate timezone when value changes
    validateTimezone(value || "");
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
        setSelectedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Timezone validation function
  const validateTimezone = (tz: string): boolean => {
    if (!tz.trim()) {
      setIsValidTimezone(true);
      return true;
    }
    
    try {
      // Test if timezone is valid by trying to format a date with it
      new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
      setIsValidTimezone(true);
      return true;
    } catch {
      setIsValidTimezone(false);
      return false;
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
          const selected = filtered[selectedIndex];
          onChange(selected);
          setInput(selected);
          setOpen(false);
          setSelectedIndex(-1);
        } else if (input.trim()) {
          // Allow custom timezone if valid
          if (validateTimezone(input.trim())) {
            onChange(input.trim());
            setOpen(false);
          }
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
        
      case 'Tab':
        setOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const filtered = useMemo(() => {
    if (!input) return TIMEZONE_OPTIONS;
    const q = input.toLowerCase();
    return TIMEZONE_OPTIONS.filter((opt) => opt.toLowerCase().includes(q));
  }, [input]);

  // Memoized timezone offset cache to prevent recalculation
  const timezoneOffsetCache = useMemo(() => {
    const cache = new Map<string, string>();
    
    const calculateOffset = (tz: string): string => {
      try {
        // CORRECT METHOD: Use Intl.DateTimeFormat with longOffset
        const formatter = new Intl.DateTimeFormat('en', {
          timeZone: tz,
          timeZoneName: 'longOffset'
        });
        
        const parts = formatter.formatToParts(new Date());
        const offsetPart = parts.find(part => part.type === 'timeZoneName');
        
        if (offsetPart?.value) {
          // Convert GMT±HH:MM to UTC±HH:MM
          return offsetPart.value.replace('GMT', 'UTC');
        }
        
        // Fallback: Manual calculation (more reliable than previous method)
        
        const offsetMinutes = getTimezoneOffsetMinutes(tz);
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        const minutes = Math.abs(offsetMinutes) % 60;
        const sign = offsetMinutes >= 0 ? '+' : '-';
        
        if (minutes === 0) {
          return `UTC${sign}${hours}`;
        } else {
          return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
        }
      } catch {
        return '';
      }
    };
    
    // Helper function for offset calculation
    const getTimezoneOffsetMinutes = (tz: string): number => {
      const date = new Date();
      const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const target = new Date(date.toLocaleString('en-US', { timeZone: tz }));
      return Math.round((target.getTime() - utc.getTime()) / (1000 * 60));
    };
    
    // Pre-calculate offsets for all timezones
    TIMEZONE_OPTIONS.forEach(tz => {
      cache.set(tz, calculateOffset(tz));
    });
    
    return cache;
  }, []); // Empty dependency array - calculate once on mount
  
  const getTimezoneOffset = (tz: string): string => {
    return timezoneOffsetCache.get(tz) || '';
  };

  return (
    <div className="relative" style={{ zIndex: 10 }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => {
          const newValue = e.target.value;
          setInput(newValue);
          onChange(newValue);
          setOpen(true);
          setSelectedIndex(-1);
          validateTimezone(newValue);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-inner focus:outline-none ${
          isValidTimezone 
            ? 'border-gray-200' 
            : 'border-red-300 bg-red-50'
        }`}
        placeholder={placeholder || "e.g. America/Los_Angeles"}
        autoComplete="off"
        aria-invalid={!isValidTimezone}
        aria-describedby={!isValidTimezone ? "timezone-error" : undefined}
      />
      {!isValidTimezone && !open && (
        <div id="timezone-error" className="mt-1 text-xs text-red-600">
          Invalid timezone. Try "America/Los_Angeles" or select from dropdown.
        </div>
      )}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length > 0 ? (
            filtered.map((opt, index) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setInput(opt);
                  setOpen(false);
                  setSelectedIndex(-1);
                  setTimeout(() => inputRef.current?.blur(), 0);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate">{opt}</span>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {getTimezoneOffset(opt)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className={`px-3 py-2 text-sm ${
              isValidTimezone ? 'text-gray-500' : 'text-red-600'
            }`}>
              {isValidTimezone 
                ? `No matches. Press Enter to use "${input}".`
                : `"${input}" is not a valid timezone.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InlineTimezoneAutocomplete;