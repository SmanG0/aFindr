"use client";

import type { AppSettings } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown, NumberInput } from "../SettingsComponents";

interface TradingSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function TradingSettings({ settings, onUpdate }: TradingSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        Trading
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Order defaults, execution preferences, and chart overlay options.
      </p>

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

      <SectionHeader title="Execution" />
      <SettingRow label="One-Click Trading" subtitle="Skip confirmation dialog">
        <Toggle checked={settings.oneClickTrading} onChange={(v) => update({ oneClickTrading: v })} />
      </SettingRow>
      <SettingRow label="Trade Execution Sound">
        <Toggle checked={settings.tradeExecutionSound} onChange={(v) => update({ tradeExecutionSound: v })} />
      </SettingRow>

      <SectionHeader title="Chart Overlay" />
      <SettingRow label="Buy/Sell Buttons on Chart">
        <Toggle checked={settings.showBuySellButtons} onChange={(v) => update({ showBuySellButtons: v })} />
      </SettingRow>
      <SettingRow label="Positions & Orders on Chart">
        <Toggle checked={settings.showPositionsOnChart} onChange={(v) => update({ showPositionsOnChart: v })} />
      </SettingRow>
      <SettingRow label="Reverse Position Button">
        <Toggle checked={settings.reversePositionButton} onChange={(v) => update({ reversePositionButton: v })} />
      </SettingRow>
      <SettingRow label="Profit & Loss Value">
        <Toggle checked={settings.showPnlOnChart} onChange={(v) => update({ showPnlOnChart: v })} />
      </SettingRow>

      <SectionHeader title="Display" />
      <SettingRow label="Show Trade History on Chart">
        <Toggle checked={settings.showTradeHistoryOnChart} onChange={(v) => update({ showTradeHistoryOnChart: v })} />
      </SettingRow>
      <SettingRow label="Big Lot Threshold">
        <NumberInput value={settings.bigLotThreshold} onChange={(v) => update({ bigLotThreshold: v })} />
      </SettingRow>
    </div>
  );
}
