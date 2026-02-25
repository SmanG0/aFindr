"use client";

import type { AppSettings, AppTheme } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown } from "../SettingsComponents";

const THEMES: { id: AppTheme; label: string; colors: [string, string, string] }[] = [
  { id: "dark-amber", label: "Dark Amber", colors: ["#1a1714", "#c47b3a", "#ece3d5"] },
  { id: "midnight-blue", label: "Midnight Blue", colors: ["#141a22", "#6b9bd4", "#e3eaf2"] },
  { id: "forest-green", label: "Forest Green", colors: ["#141a16", "#5a9b7a", "#e0ebe4"] },
  { id: "obsidian", label: "Obsidian", colors: ["#0f0f12", "#9b8bb8", "#e8e6ed"] },
  { id: "classic-light", label: "Classic Light", colors: ["#f5f2ed", "#8b6f47", "#2c2620"] },
];

const CHART_STYLES = [
  { id: "candles", label: "Candlestick" },
  { id: "bars", label: "OHLC Bars" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "heikin-ashi", label: "Heikin-Ashi" },
];

const FONT_SIZES = [
  { id: "small", label: "Small (11px)" },
  { id: "default", label: "Default (13px)" },
  { id: "large", label: "Large (15px)" },
];

interface AppearanceSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function AppearanceSettings({ settings, onUpdate }: AppearanceSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "24px 32px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        Appearance
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Customize the look and feel of the application.
      </p>

      {/* Three-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, alignItems: "start", flex: 1 }}>
        {/* Left: Themes */}
        <div>
          <SectionHeader title="Theme" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {THEMES.map((theme) => {
              const isActive = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => update({ theme: theme.id })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.02)",
                    border: isActive ? "1.5px solid var(--accent)" : "1px solid var(--divider)",
                    cursor: "pointer", transition: "all 120ms ease", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.06)"; }}
                >
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {theme.colors.map((c, i) => (
                      <div key={i} style={{
                        width: i === 0 ? 20 : 10, height: 20,
                        borderRadius: i === 0 ? "5px 0 0 5px" : i === 2 ? "0 5px 5px 0" : 0,
                        background: c,
                        border: c === "#f5f2ed" ? "1px solid rgba(0,0,0,0.08)" : "none",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{theme.label}</span>
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Chart appearance */}
        <div>
          <SectionHeader title="Chart" />
          <SettingRow label="Chart Style">
            <SelectDropdown value="candles" options={CHART_STYLES} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Candle Up Color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "#089981", border: "1px solid rgba(236,227,213,0.1)" }} />
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>#089981</span>
            </div>
          </SettingRow>
          <SettingRow label="Candle Down Color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "#f23645", border: "1px solid rgba(236,227,213,0.1)" }} />
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>#f23645</span>
            </div>
          </SettingRow>
          <SettingRow label="Grid Lines">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Crosshair">
            <SelectDropdown value="both" options={[{ id: "both", label: "Both Axes" }, { id: "horizontal", label: "Horizontal" }, { id: "vertical", label: "Vertical" }, { id: "none", label: "None" }]} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Price Scale Position">
            <SelectDropdown value="right" options={[{ id: "right", label: "Right" }, { id: "left", label: "Left" }, { id: "both", label: "Both" }]} onChange={() => {}} />
          </SettingRow>
        </div>

        {/* Right: Display & density */}
        <div>
          <SectionHeader title="Display" />
          <SettingRow label="Compact Mode" subtitle="Reduce spacing">
            <Toggle checked={settings.compactMode} onChange={(v) => update({ compactMode: v })} />
          </SettingRow>
          <SettingRow label="Font Size">
            <SelectDropdown value="default" options={FONT_SIZES} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Show Tooltips">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Animate Transitions">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>

          <SectionHeader title="Sidebar" />
          <SettingRow label="Sidebar Position">
            <SelectDropdown value="left" options={[{ id: "left", label: "Left" }, { id: "right", label: "Right" }]} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Auto-collapse Sidebar">
            <Toggle checked={false} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Show Labels">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
