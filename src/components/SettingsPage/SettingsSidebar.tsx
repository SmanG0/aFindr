"use client";

export type SettingsSection =
  | "general"
  | "appearance"
  | "trading"
  | "account"
  | "apis"
  | "broker-logins";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "trading", label: "Trading" },
  { id: "account", label: "Account" },
  { id: "apis", label: "APIs & Data" },
  { id: "broker-logins", label: "Broker Logins" },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export default function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--bg-raised)",
        borderRight: "1px solid var(--glass-border)",
        padding: "24px 0",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Settings
        </h2>
      </div>
      <nav style={{ padding: "12px 0" }}>
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "10px 20px",
                background: isActive ? "rgba(196,123,58,0.08)" : "transparent",
                border: "none",
                borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                color: isActive ? "var(--accent-bright)" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 120ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(236,227,213,0.04)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {section.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
