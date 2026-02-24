"use client";

import { useState } from "react";
import type { AppSettings, RiskSettings } from "@/lib/types";
import SettingsSidebar, { type SettingsSection } from "./SettingsSidebar";
import GeneralSettings from "./subpages/GeneralSettings";
import AppearanceSettings from "./subpages/AppearanceSettings";
import TradingSettings from "./subpages/TradingSettings";
import AccountSettings from "./subpages/AccountSettings";
import ApiSettings from "./subpages/ApiSettings";
import BrokerLoginsSettings from "./subpages/BrokerLoginsSettings";
import RiskManagement from "@/components/RiskManagement/RiskManagement";

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  riskSettings?: RiskSettings;
  onUpdateRiskSettings?: (settings: RiskSettings) => void;
  onBack?: () => void;
}

export default function SettingsPage({ settings, onUpdateSettings, riskSettings, onUpdateRiskSettings, onBack }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const update = (patch: Partial<AppSettings>) => onUpdateSettings({ ...settings, ...patch });

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings settings={settings} onUpdate={update} />;
      case "appearance":
        return <AppearanceSettings settings={settings} onUpdate={update} />;
      case "trading":
        return <TradingSettings settings={settings} onUpdate={update} />;
      case "risk":
        return riskSettings && onUpdateRiskSettings ? (
          <RiskManagement
            isOpen={true}
            onClose={() => setActiveSection("general")}
            settings={riskSettings}
            onUpdateSettings={onUpdateRiskSettings}
            embedded
          />
        ) : null;
      case "account":
        return <AccountSettings settings={settings} onUpdate={update} />;
      case "apis":
        return <ApiSettings />;
      case "broker-logins":
        return <BrokerLoginsSettings />;
      default:
        return <GeneralSettings settings={settings} onUpdate={update} />;
    }
  };

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          background: "var(--bg)",
        }}
      >
        {onBack && (
          <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onBack}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none",
                color: "var(--text-muted)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", padding: "6px 0",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        )}
        {renderContent()}
      </main>
    </div>
  );
}
