"use client";

import type { AppSettings, AppTheme } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader } from "../SettingsComponents";

const THEMES: { id: AppTheme; label: string; colors: [string, string, string] }[] = [
  { id: "dark-amber", label: "Dark Amber", colors: ["#1a1714", "#c47b3a", "#ece3d5"] },
  { id: "midnight-blue", label: "Midnight Blue", colors: ["#141a22", "#6b9bd4", "#e3eaf2"] },
  { id: "forest-green", label: "Forest Green", colors: ["#141a16", "#5a9b7a", "#e0ebe4"] },
  { id: "obsidian", label: "Obsidian", colors: ["#0f0f12", "#9b8bb8", "#e8e6ed"] },
  { id: "classic-light", label: "Classic Light", colors: ["#f5f2ed", "#8b6f47", "#2c2620"] },
];

interface AppearanceSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function AppearanceSettings({ settings, onUpdate }: AppearanceSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        Appearance
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Customize the look and feel of the application.
      </p>

      <SectionHeader title="Theme" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {THEMES.map((theme) => {
          const isActive = settings.theme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => update({ theme: theme.id })}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12,
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
                    width: i === 0 ? 24 : 12, height: 24,
                    borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : 0,
                    background: c,
                    border: c === "#f5f2ed" ? "1px solid rgba(0,0,0,0.08)" : "none",
                  }} />
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{theme.label}</div>
              </div>
              {isActive && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <SectionHeader title="Display" />
      <SettingRow label="Compact Mode" subtitle="Reduce spacing for more data density">
        <Toggle checked={settings.compactMode} onChange={(v) => update({ compactMode: v })} />
      </SettingRow>
    </div>
  );
}
