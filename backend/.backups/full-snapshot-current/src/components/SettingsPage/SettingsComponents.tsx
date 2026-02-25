"use client";

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 36, height: 20, borderRadius: 9999,
        background: checked ? "var(--accent)" : "rgba(236,227,213,0.1)",
        border: "none", cursor: "pointer", transition: "background 0.2s ease", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s ease",
      }} />
    </button>
  );
}

export function SettingRow({ label, subtitle, children }: { label: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: "var(--text-primary)", display: "block" }}>{label}</span>
        {subtitle && <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, display: "block" }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 10 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
        {title}
      </div>
      {badge && (
        <span style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 100,
          background: "rgba(34,171,148,0.12)", color: "var(--buy)",
          fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function SelectDropdown({ value, options, onChange, style }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.08)",
        borderRadius: 8, color: "var(--text-primary)", fontSize: 13, padding: "8px 12px",
        outline: "none", cursor: "pointer", minWidth: 140, appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 36,
        ...style,
      }}
    >
      {options.map((o) => <option key={o.id} value={o.id} style={{ background: "#1a1714", color: "#ece3d5" }}>{o.label}</option>)}
    </select>
  );
}

export function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) onChange(parsed);
      }}
      style={{
        width: 80, background: "rgba(236,227,213,0.04)",
        border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
        color: "var(--text-primary)", fontSize: 13, padding: "8px 12px",
        outline: "none", fontVariantNumeric: "tabular-nums", textAlign: "right",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; }}
    />
  );
}

export function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", background: "rgba(236,227,213,0.04)",
        border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
        color: "var(--text-primary)", fontSize: 13, padding: "8px 14px", outline: "none",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; }}
    />
  );
}
