# Liquid Glass UI Redesign — Apple Vision Pro Style

**Date:** 2026-02-22
**Approach:** Glass Shell Overlay (Approach 1 — rework in-place)
**Animation:** Framer Motion (spring physics, layout animations)
**Aesthetic:** Apple visionOS meets Bloomberg Terminal

---

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#050508` | Page background (blue undertone) |
| `--glass` | `rgba(255,255,255,0.03)` | Panel backgrounds |
| `--glass-border` | `rgba(255,255,255,0.06)` | Subtle borders |
| `--glass-hover` | `rgba(255,255,255,0.05)` | Hover/active states |
| `--accent` | `#6366f1` | Primary accent (indigo) |
| `--accent-glow` | `rgba(99,102,241,0.15)` | Soft glow behind active elements |
| `--accent-muted` | `rgba(99,102,241,0.08)` | Subtle accent backgrounds |
| `--buy` | `#34d399` | Profit/long (emerald-400) |
| `--sell` | `#f87171` | Loss/short (red-400) |
| `--text-primary` | `rgba(255,255,255,0.92)` | Main text |
| `--text-secondary` | `rgba(255,255,255,0.5)` | Secondary text |
| `--text-muted` | `rgba(255,255,255,0.25)` | Muted/disabled text |

## Glass Panel Recipe

```css
.glass {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
```

Border radii: 16px (panels), 12px (cards), 8px (buttons/inputs)

## Component Changes

### Command Bar
- Floating glass pill, 12px from edges, rounded-2xl
- Symbol selector → pill chips with active indigo glow
- Interval buttons → ring highlight on active
- Input → pulsing indigo border glow on focus
- Framer: layoutId for active indicator, spring on focus

### Chat Panel
- Floating glass sidebar with 12px gap from edge
- User messages → indigo glass bubbles
- Assistant messages → neutral glass bubbles
- Strategy badges → animated number counters
- Framer: AnimatePresence for enter/exit, slide-in from right

### Trading Panel
- Floating glass panel lifted from bottom
- Tab indicator slides with layoutId
- Metric cards → glass with gradient borders
- P/L animates on change
- Equity bars → animated height reveal

### Replay Controls
- Glass strip overlay at bottom of chart
- Play button pulse when active
- Progress bar → glowing indigo track
- Speed chips → pill treatment

### Chart
- Container gets rounded corners + glass border
- Background → #050508
- Soft glow on trade execution

## Framer Motion Animations

- Page load: staggered reveal (bar → chart → panels), 80ms stagger
- Panel toggle: spring(damping:25, stiffness:300)
- Data loading: skeleton shimmer
- Backtest complete: metric cards cascade in, 50ms stagger, numbers count up
- Tab switch: layoutId shared indicator
- Hover: glass brightens 0.03→0.05, 200ms

## Bug Fixes (bundled)

1. Create backend/.env.example
2. Fix strategy_agent.py sync/async mismatch
3. Add error handling for missing API key in chat
