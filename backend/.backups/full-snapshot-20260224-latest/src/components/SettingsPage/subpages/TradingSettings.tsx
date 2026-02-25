"use client";

import type { AppSettings } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown, NumberInput } from "../SettingsComponents";

interface TradingSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const HOTKEYS = [
  { action: "Buy Market", key: "B" },
  { action: "Sell Market", key: "S" },
  { action: "Close Position", key: "Shift+C" },
  { action: "Cancel All Orders", key: "Shift+X" },
  { action: "Flatten All", key: "Shift+F" },
  { action: "Increase Size", key: "+" },
  { action: "Decrease Size", key: "-" },
  { action: "Toggle Chart Crosshair", key: "Alt+C" },
];

export default function TradingSettings({ settings, onUpdate }: TradingSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "24px 32px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        Trading
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Order defaults, execution preferences, and chart overlay options.
      </p>

      {/* Three-column layout to fill the space */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, alignItems: "start", flex: 1 }}>
        {/* Left column */}
        <div>
          <SectionHeader title="Order Defaults" />
          <SettingRow label="Default Order Type">
            <SelectDropdown
              value={settings.defaultOrderType}
              options={[{ id: "market", label: "Market" }, { id: "limit", label: "Limit" }]}
              onChange={(v) => update({ defaultOrderType: v as "market" | "limit" })}
            />
          </SettingRow>
          <SettingRow label="Default Lot Size">
            <NumberInput value={settings.defaultLotSize} onChange={(v) => update({ defaultLotSize: v })} />
          </SettingRow>
          <SettingRow label="Slippage Tolerance">
            <SelectDropdown
              value="2"
              options={[{ id: "0", label: "0 ticks" }, { id: "1", label: "1 tick" }, { id: "2", label: "2 ticks" }, { id: "5", label: "5 ticks" }]}
              onChange={() => {}}
            />
          </SettingRow>
          <SettingRow label="Confirm Before Order" subtitle="Except one-click mode">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>

          <SectionHeader title="Execution" />
          <SettingRow label="One-Click Trading" subtitle="Skip confirmation">
            <Toggle checked={settings.oneClickTrading} onChange={(v) => update({ oneClickTrading: v })} />
          </SettingRow>
          <SettingRow label="Execution Sound">
            <Toggle checked={settings.tradeExecutionSound} onChange={(v) => update({ tradeExecutionSound: v })} />
          </SettingRow>
          <SettingRow label="Sound Volume">
            <SelectDropdown
              value="medium"
              options={[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }]}
              onChange={() => {}}
            />
          </SettingRow>
        </div>

        {/* Center column */}
        <div>
          <SectionHeader title="Chart Overlay" />
          <SettingRow label="Buy/Sell Buttons">
            <Toggle checked={settings.showBuySellButtons} onChange={(v) => update({ showBuySellButtons: v })} />
          </SettingRow>
          <SettingRow label="Positions & Orders">
            <Toggle checked={settings.showPositionsOnChart} onChange={(v) => update({ showPositionsOnChart: v })} />
          </SettingRow>
          <SettingRow label="Reverse Position Btn">
            <Toggle checked={settings.reversePositionButton} onChange={(v) => update({ reversePositionButton: v })} />
          </SettingRow>
          <SettingRow label="P&L Value">
            <Toggle checked={settings.showPnlOnChart} onChange={(v) => update({ showPnlOnChart: v })} />
          </SettingRow>

          <SectionHeader title="Display" />
          <SettingRow label="Trade History on Chart">
            <Toggle checked={settings.showTradeHistoryOnChart} onChange={(v) => update({ showTradeHistoryOnChart: v })} />
          </SettingRow>
          <SettingRow label="Big Lot Threshold">
            <NumberInput value={settings.bigLotThreshold} onChange={(v) => update({ bigLotThreshold: v })} />
          </SettingRow>
          <SettingRow label="Show Spread">
            <Toggle checked={true} onChange={() => {}} />
          </SettingRow>
          <SettingRow label="Show Depth of Market">
            <Toggle checked={false} onChange={() => {}} />
          </SettingRow>
        </div>

        {/* Right column — Hotkeys reference */}
        <div>
          <SectionHeader title="Keyboard Shortcuts" />
          <div style={{
            background: "rgba(236,227,213,0.02)", borderRadius: 10,
            border: "1px solid rgba(236,227,213,0.06)", overflow: "hidden",
          }}>
            {HOTKEYS.map((hk, i) => (
              <div
                key={hk.action}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 14px",
                  borderBottom: i < HOTKEYS.length - 1 ? "1px solid rgba(236,227,213,0.04)" : "none",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{hk.action}</span>
                <kbd style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                  color: "var(--text-primary)", background: "rgba(236,227,213,0.06)",
                  padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(236,227,213,0.1)",
                }}>
                  {hk.key}
                </kbd>
              </div>
            ))}
          </div>

          <SectionHeader title="Quick Size Presets" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Small", value: "10" },
              { label: "Medium", value: "100" },
              { label: "Large", value: "500" },
            ].map((preset) => (
              <div
                key={preset.label}
                style={{
                  padding: "10px", borderRadius: 8, textAlign: "center",
                  background: "rgba(236,227,213,0.02)", border: "1px solid rgba(236,227,213,0.06)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{preset.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{preset.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
