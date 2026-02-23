"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───

interface TimezoneSelectorProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  theme: "dark" | "light";
}

interface TimezoneOption {
  value: string;
  label: string;
  abbr?: string;
}

// ─── Constants ───

const AUTO_DETECT = "auto";

const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: AUTO_DETECT, label: "Auto-detect" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York", abbr: "ET" },
  { value: "America/Chicago", label: "Chicago", abbr: "CT" },
  { value: "America/Los_Angeles", label: "Los Angeles", abbr: "PT" },
  { value: "Europe/London", label: "London", abbr: "GMT" },
  { value: "Europe/Berlin", label: "Berlin", abbr: "CET" },
  { value: "Asia/Tokyo", label: "Tokyo", abbr: "JST" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", abbr: "HKT" },
  { value: "Asia/Shanghai", label: "Shanghai", abbr: "CST" },
];

// ─── Helpers ───

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function getTimezoneAbbr(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

function getCityName(tz: string): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  return city ?? tz;
}

function resolveTimezone(tz: string): string {
  return tz === AUTO_DETECT ? getLocalTimezone() : tz;
}

// ─── Component ───

export default function TimezoneSelector({
  timezone,
  onTimezoneChange,
  theme,
}: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLight = theme === "light";
  const resolvedTz = resolveTimezone(timezone);
  const abbr = getTimezoneAbbr(resolvedTz);
  const city = getCityName(resolvedTz);

  // ─── Close on click outside ───
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    const timeout = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // ─── Close on Escape ───
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSelect = useCallback(
    (value: string) => {
      onTimezoneChange(value);
      setOpen(false);
    },
    [onTimezoneChange],
  );

  // ─── Theme colors ───
  const bg = isLight ? "#ffffff" : "#1e1e22";
  const borderColor = isLight
    ? "rgba(0,0,0,0.1)"
    : "rgba(236,227,213,0.1)";
  const textPrimary = isLight ? "rgba(0,0,0,0.7)" : "rgba(236,227,213,0.65)";
  const textSecondary = isLight
    ? "rgba(0,0,0,0.45)"
    : "rgba(236,227,213,0.4)";
  const hoverBg = isLight
    ? "rgba(0,0,0,0.04)"
    : "rgba(236,227,213,0.06)";
  const accentColor = "#c47b3a";

  // ─── Button label ───
  const buttonLabel = `${abbr} \u00B7 ${city} \u25BE`;

  // ─── Build dropdown display for auto-detect ───
  const localTz = getLocalTimezone();
  const localAbbr = getTimezoneAbbr(localTz);
  const localCity = getCityName(localTz);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* ─── Trigger Button ─── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          padding: "3px 7px",
          fontSize: 10,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontWeight: 500,
          color: textPrimary,
          background: "transparent",
          border: `0.667px solid ${borderColor}`,
          borderRadius: 4,
          cursor: "pointer",
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          lineHeight: 1.4,
          transition: "border-color 150ms ease, color 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = isLight
            ? "rgba(0,0,0,0.2)"
            : "rgba(236,227,213,0.2)";
          (e.currentTarget as HTMLElement).style.color = isLight
            ? "rgba(0,0,0,0.85)"
            : "rgba(236,227,213,0.85)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = borderColor;
          (e.currentTarget as HTMLElement).style.color = textPrimary;
        }}
      >
        {buttonLabel}
      </button>

      {/* ─── Dropdown (opens upward) ─── */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            right: 0,
            minWidth: 220,
            background: bg,
            border: `0.667px solid ${borderColor}`,
            borderRadius: 6,
            boxShadow: isLight
              ? "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)"
              : "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "4px 0",
            zIndex: 9999,
            fontFamily: "'Inter', system-ui, sans-serif",
            userSelect: "none",
          }}
        >
          {TIMEZONE_OPTIONS.map((option, index) => {
            const isSelected = timezone === option.value;
            const isHovered = hoveredIndex === index;
            const isAutoOption = option.value === AUTO_DETECT;

            // Display text for the option
            let displayLabel: string;
            let displaySub: string | null = null;

            if (isAutoOption) {
              displayLabel = "Auto-detect";
              displaySub = `${localAbbr} \u00B7 ${localCity}`;
            } else if (option.value === "UTC") {
              displayLabel = "UTC";
              displaySub = null;
            } else {
              displayLabel = option.label;
              displaySub = option.abbr ?? null;
            }

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: 11,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected
                    ? accentColor
                    : isLight
                      ? "rgba(0,0,0,0.75)"
                      : "rgba(236,227,213,0.75)",
                  background: isHovered ? hoverBg : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  lineHeight: 1.4,
                  transition: "background 80ms ease",
                }}
              >
                {/* Checkmark column */}
                <span
                  style={{
                    width: 14,
                    flexShrink: 0,
                    fontSize: 12,
                    lineHeight: 1,
                    color: accentColor,
                    textAlign: "center",
                  }}
                >
                  {isSelected ? "\u2713" : ""}
                </span>

                {/* Label */}
                <span style={{ flex: 1 }}>{displayLabel}</span>

                {/* Abbreviation / sub-label */}
                {displaySub && (
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily:
                        "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      color: isSelected
                        ? accentColor
                        : textSecondary,
                      opacity: isSelected ? 0.85 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {displaySub}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
