"use client";

export type SettingsSection =
  | "general"
  | "appearance"
  | "trading"
  | "risk"
  | "account"
  | "apis"
  | "broker-logins";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; premium?: boolean }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "trading", label: "Trading" },
  { id: "risk", label: "Risk Management", premium: true },
  { id: "account", label: "Account" },
  { id: "apis", label: "APIs & Data", premium: true },
  { id: "broker-logins", label: "Broker Logins", premium: true },
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
              {section.premium && (
                <span style={{
                  fontSize: 8, fontWeight: 800, fontFamily: "var(--font-mono)",
                  padding: "1px 5px", borderRadius: 4, marginLeft: "auto",
                  background: "linear-gradient(135deg, rgba(196,123,58,0.2), rgba(212,175,55,0.2))",
                  color: "#d4af37", letterSpacing: "0.06em", lineHeight: 1.4,
                  border: "1px solid rgba(212,175,55,0.15)",
                }}>
                  PRO
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
