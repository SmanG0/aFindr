"use client";

import type { AppSettings, AppCurrency } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown, NumberInput, TextInput } from "../SettingsComponents";

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "sw", label: "Kiswahili" },
];

const REGIONS = [
  { id: "ke", label: "Kenya (NSE)" },
  { id: "ug", label: "Uganda (USE)" },
  { id: "tz", label: "Tanzania (DSE)" },
  { id: "rw", label: "Rwanda (RSE)" },
  { id: "us", label: "United States (NYSE/NASDAQ)" },
  { id: "gb", label: "United Kingdom (LSE)" },
];

const CURRENCIES: { id: AppCurrency; label: string; symbol: string }[] = [
  { id: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { id: "USD", label: "US Dollar", symbol: "$" },
  { id: "GBP", label: "British Pound", symbol: "£" },
  { id: "EUR", label: "Euro", symbol: "€" },
];

interface GeneralSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function GeneralSettings({ settings, onUpdate }: GeneralSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "24px 32px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        General
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Language, region, currency, and notification preferences.
      </p>

      {/* Two-column layout: Language & Region on left, Notifications on right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start", flex: 1 }}>
        {/* Left column */}
        <div>
          <SectionHeader title="Language & Region" />
          {/* Inline 3-column row for dropdowns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Language</div>
              <SelectDropdown value={settings.language} options={LANGUAGES} onChange={(v) => update({ language: v })} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Market Region</div>
              <SelectDropdown value={settings.marketRegion} options={REGIONS} onChange={(v) => update({ marketRegion: v })} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Currency</div>
              <SelectDropdown
                value={settings.currency}
                options={CURRENCIES.map((c) => ({ id: c.id, label: `${c.symbol} ${c.id}` }))}
                onChange={(v) => update({ currency: v as AppCurrency })}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <SectionHeader title="About" />
          <div style={{ background: "rgba(236,227,213,0.02)", borderRadius: 10, border: "1px solid rgba(236,227,213,0.06)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>aFindr</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>v1.0.0 (2026.02)</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 10 }}>
              Regulated by the Capital Markets Authority (CMA) Kenya. Charts by TradingView. Market data by Refinitiv.
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Terms
              </button>
              <button style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                Privacy
              </button>
              <button
                onClick={() => typeof window !== "undefined" && window.location.reload()}
                style={{
                  fontSize: 11, color: "var(--text-secondary)", background: "rgba(236,227,213,0.06)",
                  border: "1px solid rgba(236,227,213,0.1)", borderRadius: 6, padding: "4px 10px",
                  cursor: "pointer", fontWeight: 500, marginLeft: "auto",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.1)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                Restart app
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <SectionHeader title="Notifications" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
            <SettingRow label="In-App">
              <Toggle checked={settings.showNotifications} onChange={(v) => update({ showNotifications: v })} />
            </SettingRow>
            <SettingRow label="Push" subtitle="Browser push">
              <Toggle checked={settings.pushNotifications} onChange={(v) => update({ pushNotifications: v })} />
            </SettingRow>
            <SettingRow label="SMS Alerts" subtitle="Safaricom SMS">
              <Toggle checked={settings.smsAlerts} onChange={(v) => update({ smsAlerts: v })} />
            </SettingRow>
            <SettingRow label="Duration (sec)">
              <NumberInput value={settings.notificationDuration} onChange={(v) => update({ notificationDuration: v })} />
            </SettingRow>
          </div>
          {settings.smsAlerts && (
            <div style={{ padding: "8px 0 0" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Phone Number</div>
              <TextInput
                value={settings.smsPhone}
                onChange={(v) => update({ smsPhone: v })}
                placeholder="+254 7XX XXX XXX"
                type="tel"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
