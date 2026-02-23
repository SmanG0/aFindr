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
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        General
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Language, region, currency, and notification preferences.
      </p>

      <SectionHeader title="Language & Region" />
      <SettingRow label="Language">
        <SelectDropdown value={settings.language} options={LANGUAGES} onChange={(v) => update({ language: v })} />
      </SettingRow>
      <SettingRow label="Market Region">
        <SelectDropdown value={settings.marketRegion} options={REGIONS} onChange={(v) => update({ marketRegion: v })} />
      </SettingRow>
      <SettingRow label="Currency">
        <SelectDropdown
          value={settings.currency}
          options={CURRENCIES.map((c) => ({ id: c.id, label: `${c.symbol} ${c.id}` }))}
          onChange={(v) => update({ currency: v as AppCurrency })}
        />
      </SettingRow>

      <SectionHeader title="Notifications" />
      <SettingRow label="In-App Notifications">
        <Toggle checked={settings.showNotifications} onChange={(v) => update({ showNotifications: v })} />
      </SettingRow>
      <SettingRow label="Push Notifications" subtitle="Browser push for price alerts">
        <Toggle checked={settings.pushNotifications} onChange={(v) => update({ pushNotifications: v })} />
      </SettingRow>
      <SettingRow label="SMS Alerts" subtitle="Via Safaricom SMS gateway">
        <Toggle checked={settings.smsAlerts} onChange={(v) => update({ smsAlerts: v })} />
      </SettingRow>
      {settings.smsAlerts && (
        <div style={{ padding: "8px 0 16px" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Phone Number</div>
          <TextInput
            value={settings.smsPhone}
            onChange={(v) => update({ smsPhone: v })}
            placeholder="+254 7XX XXX XXX"
            type="tel"
          />
        </div>
      )}
      <SettingRow label="Notification Duration (seconds)">
        <NumberInput value={settings.notificationDuration} onChange={(v) => update({ notificationDuration: v })} />
      </SettingRow>

      <SectionHeader title="About" />
      <div style={{ background: "rgba(236,227,213,0.02)", borderRadius: 12, border: "1px solid rgba(236,227,213,0.06)", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>aFindr</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
          Version 1.0.0 (Build 2026.02)
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Regulated by the Capital Markets Authority (CMA) Kenya. Licensed under the Nairobi Securities Exchange.
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.6 }}>
          Charts by TradingView. Market data provided by Refinitiv.
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Terms of Service
          </button>
          <button style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Privacy Policy
          </button>
          <button
            onClick={() => typeof window !== "undefined" && window.location.reload()}
            style={{
              fontSize: 12, color: "var(--text-secondary)", background: "rgba(236,227,213,0.06)",
              border: "1px solid rgba(236,227,213,0.1)", borderRadius: 6, padding: "6px 12px",
              cursor: "pointer", fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.1)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Restart app
          </button>
        </div>
      </div>
    </div>
  );
}
