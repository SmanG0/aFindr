# Chart Drawing Tools & Crosshair Redesign

**Date:** 2026-02-23
**Status:** Approved

## Overview

Replace the custom SVG drawing overlay system with `lightweight-charts-line-tools-core` plugin ecosystem. Add MagnetOHLC crosshair snapping. Expand from 8 tools to 14 core trader tools with full edit capabilities.

## 1. Crosshair Behavior

- **Default:** `CrosshairMode.MagnetOHLC` — horizontal crosshair snaps to nearest OHLC value on hovered candle
- **Magnet toggle (existing button):**
  - ON (default) → `CrosshairMode.MagnetOHLC`
  - OFF → `CrosshairMode.Normal` (free movement)
- Implementation: single option swap in `Chart.tsx` crosshair config based on `magnetEnabled` prop

## 2. Plugin Architecture

### Remove
- `src/components/Chart/DrawingOverlay.tsx` (688 lines)
- `src/hooks/useDrawings.ts` (275 lines)
- All drawing-related mouse tracking/state in `page.tsx`

### Add Packages
- `lightweight-charts-line-tools-core` — orchestrator
- `lightweight-charts-line-tools-lines` — TrendLine, HorizontalLine, Ray, Arrow
- `lightweight-charts-line-tools-rectangle` — Rectangle, Channel
- `lightweight-charts-line-tools-fib-retracement` — Fibonacci

### New Hook: `useLineTools.ts`
- Wraps `createLineToolsPlugin()` initialization
- Registers all tool types on chart/series ready
- localStorage import/export via `subscribeLineToolsAfterEdit`
- Exposes: `addTool()`, `removeSelected()`, `removeAll()`, `toggleVisibility()`, `setMagnet()`

## 3. Drawing Tools (14 total)

### Lines (6)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Trendline | `LineToolTrendLine` | 2 | Diagonal line between two points |
| Horizontal Line | `LineToolHorizontalLine` | 1 | Horizontal support/resistance |
| Vertical Line | Custom primitive | 1 | Vertical time marker |
| Ray | `LineToolTrendLine` (extended right) | 2 | Extends infinitely in one direction |
| Arrow | Custom primitive | 2 | Directional arrow line |
| Extended Line | `LineToolTrendLine` (extended both) | 2 | Infinite line both directions |

### Shapes (2)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Rectangle | `LineToolRectangle` | 2 | Box highlight area |
| Channel | `LineToolRectangle` variant | 2 | Parallel lines with fill |

### Fibonacci (1)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Fib Retracement | `LineToolFibRetracement` | 2 | Standard levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0 |

### Measurement (2)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Measure | `LineToolRectangle` + overlay | 2 | Price range, % change, bar count |
| Ruler | `LineToolTrendLine` + overlay | 2 | Distance with pixel measurement |

### Annotations (2)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Text | Custom primitive | 1 | Text label at point |
| Brush | Custom primitive | N | Freehand drawing path |

### Utility (1)
| Tool | Plugin Type | Points | Description |
|------|------------|--------|-------------|
| Eraser | Selection mode | 0 | Click any drawing to delete it |

## 4. Double-Click Edit Modal

Triggered by `subscribeLineToolsDoubleClick`. Floating panel anchored near the drawing.

### Editable Properties
- **Color** — line/border color with preset swatches + hex input
- **Border/line width** — 1-5px
- **Fill color & opacity** — for filled shapes (channel, fib, rectangle)
- **Line style** — solid, dashed, dotted
- **Extend lines** — left/right/both (for trendlines, rays, hlines)
- **Text label** — optional annotation text
- **Font size** — 12-24px for text tools
- **Lock position** — prevent accidental drag

### UI Design
- Dark floating panel matching existing theme (#1a1a2e background, #c47b3a accents)
- Appears near clicked drawing, auto-positioned to stay in viewport
- Close on click outside or Escape key
- Apply changes in real-time as user adjusts

## 5. Drawing Interactions (built-in from plugin)

- Click to select → shows selection handles
- Drag to move
- Drag handles to resize/adjust endpoints
- Delete key or toolbar trash removes selected
- Multi-select with Shift+click (if supported by plugin)

## 6. LeftSidebar Integration

Keep existing layout and icon structure. Changes:
- Tool buttons call `lineTools.addLineTool('ToolType')` instead of setting state
- Add new tool icons for: Vertical Line, Ray, Arrow, Extended Line, Rectangle, Brush, Eraser
- Magnet toggle switches `CrosshairMode` on chart
- Stay-in-drawing-mode delegates to plugin behavior
- Visibility toggle uses plugin show/hide
- Delete all uses `lineTools.removeAllLineTools()`

## 7. Data Migration

One-time migration from old localStorage format (`afindr_drawings`) to plugin format:
1. Read old drawings on first load
2. Convert each to `createOrUpdateLineTool()` calls with mapped types
3. Export to new format via plugin
4. Remove old `afindr_drawings` key

## 8. Files Changed

### Modified
- `src/components/Chart/Chart.tsx` — crosshair mode, plugin initialization, remove drawing handlers
- `src/components/LeftSidebar/LeftSidebar.tsx` — expanded tools, plugin API calls
- `src/app/page.tsx` — remove old drawing state, wire up new hook
- `src/lib/types.ts` — updated DrawingTool type

### New
- `src/hooks/useLineTools.ts` — plugin wrapper hook
- `src/components/Chart/DrawingEditModal.tsx` — double-click edit panel

### Removed
- `src/components/Chart/DrawingOverlay.tsx`
- `src/hooks/useDrawings.ts`
