"use client";

import { useState, type ReactNode } from "react";

export type DrawingTool =
  | "crosshair" | "trendline" | "hline" | "channel"
  | "fib" | "measure" | "text" | "ruler";

interface LeftSidebarProps {
  activeTool?: DrawingTool;
  onToolChange?: (tool: DrawingTool) => void;
  onDeleteAll?: () => void;
  onToggleVisibility?: () => void;
  drawingsVisible?: boolean;
  magnetEnabled?: boolean;
  onToggleMagnet?: () => void;
}

export default function LeftSidebar({
  activeTool: controlledTool,
  onToolChange,
  onDeleteAll,
  onToggleVisibility,
  drawingsVisible = true,
  magnetEnabled = false,
  onToggleMagnet,
}: LeftSidebarProps) {
  const [internalTool, setInternalTool] = useState<DrawingTool>("crosshair");
  const currentTool = controlledTool ?? internalTool;

  const handleToolClick = (tool: DrawingTool) => {
    setInternalTool(tool);
    onToolChange?.(tool);
  };

  const tools: { id: DrawingTool; label: string; icon: ReactNode }[] = [
    {
      id: "crosshair",
      label: "Crosshair",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx={12} cy={12} r={10} />
          <line x1={12} y1={2} x2={12} y2={6} />
          <line x1={12} y1={18} x2={12} y2={22} />
          <line x1={2} y1={12} x2={6} y2={12} />
          <line x1={18} y1={12} x2={22} y2={12} />
        </svg>
      ),
    },
    {
      id: "trendline",
      label: "Trend Line",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={4} y1={20} x2={20} y2={4} />
        </svg>
      ),
    },
    {
      id: "hline",
      label: "Horizontal Line",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={2} y1={12} x2={22} y2={12} />
        </svg>
      ),
    },
    {
      id: "channel",
      label: "Channel",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={4} y1={18} x2={20} y2={4} />
          <line x1={4} y1={22} x2={20} y2={8} />
        </svg>
      ),
    },
    {
      id: "fib",
      label: "Fibonacci",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={2} y1={6} x2={22} y2={6} />
          <line x1={2} y1={12} x2={22} y2={12} />
          <line x1={2} y1={18} x2={22} y2={18} />
        </svg>
      ),
    },
    {
      id: "measure",
      label: "Measure",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x={4} y={4} width={16} height={16} />
          <line x1={4} y1={4} x2={20} y2={20} />
        </svg>
      ),
    },
    {
      id: "text",
      label: "Text",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={6} y1={6} x2={18} y2={6} />
          <line x1={12} y1={6} x2={12} y2={20} />
        </svg>
      ),
    },
    {
      id: "ruler",
      label: "Ruler",
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1={4} y1={20} x2={20} y2={4} />
          <line x1={4} y1={20} x2={6} y2={18} />
          <line x1={20} y1={4} x2={18} y2={6} />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 45,
        height: "100%",
        background: "var(--bg)",
        borderRight: "0.667px solid rgba(236,227,213,0.15)",
        paddingTop: 8,
        alignItems: "center",
        gap: 2,
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`toolbar-btn${currentTool === tool.id ? " active" : ""}`}
          onClick={() => handleToolClick(tool.id)}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}

      {/* Magnet */}
      <button
        className={`toolbar-btn${magnetEnabled ? " active" : ""}`}
        onClick={onToggleMagnet}
        title="Magnet mode"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M7,2 L7,12 a5,5,0,0,0,10,0 L17,2" />
        </svg>
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Divider */}
      <div style={{ width: "60%", height: 1, background: "rgba(236,227,213,0.08)", marginTop: 8, marginBottom: 8 }} />

      {/* Lock (currently decorative) */}
      <button className="toolbar-btn" title="Lock drawings">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x={6} y={11} width={12} height={9} rx={2} />
          <path d="M8,11 V7 a4,4,0,0,1,8,0 V11" />
        </svg>
      </button>

      {/* Eye (visibility toggle) */}
      <button
        className={`toolbar-btn${!drawingsVisible ? " active" : ""}`}
        onClick={onToggleVisibility}
        title={drawingsVisible ? "Hide drawings" : "Show drawings"}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          {drawingsVisible ? (
            <>
              <path d="M2,12 s4,-8,10,-8 s6,2,10,8" />
              <path d="M2,12 s4,8,10,8 s6,-2,10,-8" />
              <circle cx={12} cy={12} r={3} />
            </>
          ) : (
            <>
              <path d="M2,12 s4,-8,10,-8 s6,2,10,8" />
              <path d="M2,12 s4,8,10,8 s6,-2,10,-8" />
              <line x1={4} y1={4} x2={20} y2={20} />
            </>
          )}
        </svg>
      </button>

      {/* Trash (delete all drawings) */}
      <button
        className="toolbar-btn"
        onClick={onDeleteAll}
        title="Delete all drawings"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="3,6 5,20 19,20 21,6" />
          <line x1={1} y1={6} x2={23} y2={6} />
          <line x1={10} y1={10} x2={10} y2={16} />
          <line x1={14} y1={10} x2={14} y2={16} />
        </svg>
      </button>
    </div>
  );
}
