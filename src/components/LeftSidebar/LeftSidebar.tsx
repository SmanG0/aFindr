"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";

export type DrawingTool =
  | "crosshair"
  | "trendline" | "hline" | "vline" | "ray" | "arrow" | "extendedline"
  | "rectangle" | "channel"
  | "fib"
  | "measure" | "ruler"
  | "text" | "brush"
  | "eraser";

interface ToolDef {
  id: DrawingTool;
  label: string;
  icon: ReactNode;
}

interface ToolGroup {
  tools: ToolDef[];
}

interface LeftSidebarProps {
  activeTool?: DrawingTool;
  onToolChange?: (tool: DrawingTool) => void;
  onDeleteAll?: () => void;
  onToggleVisibility?: () => void;
  drawingsVisible?: boolean;
  magnetEnabled?: boolean;
  onToggleMagnet?: () => void;
  stayInDrawingMode?: boolean;
  onToggleStayInDrawingMode?: () => void;
}

// ─── Dropdown for a tool group ───

function ToolGroupButton({
  group,
  currentTool,
  onToolSelect,
}: {
  group: ToolGroup;
  currentTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Find the active tool in this group, or default to the first
  const activeTool = group.tools.find((t) => t.id === currentTool) ?? group.tools[0];
  const isGroupActive = group.tools.some((t) => t.id === currentTool);
  const hasMultiple = group.tools.length > 1;

  // Calculate dropdown position when opening
  const openDropdown = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.top,
        left: rect.right + 4,
      });
    }
    setOpen(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleMainClick = useCallback(() => {
    if (!hasMultiple) {
      onToolSelect(activeTool.id);
      return;
    }
    if (isGroupActive) {
      if (open) {
        setOpen(false);
      } else {
        openDropdown();
      }
    } else {
      onToolSelect(activeTool.id);
    }
  }, [activeTool.id, hasMultiple, isGroupActive, onToolSelect, open, openDropdown]);

  const handleArrowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      openDropdown();
    }
  }, [open, openDropdown]);

  const handleToolPick = useCallback((tool: DrawingTool) => {
    onToolSelect(tool);
    setOpen(false);
  }, [onToolSelect]);

  return (
    <div
      style={{ width: "100%" }}
      onMouseEnter={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }}
      onMouseLeave={() => {
        if (open) {
          timeoutRef.current = setTimeout(() => setOpen(false), 300);
        }
      }}
    >
      {/* Main button */}
      <button
        ref={buttonRef}
        className={`toolbar-btn${isGroupActive ? " active" : ""}`}
        onClick={handleMainClick}
        title={activeTool.label}
        style={{ position: "relative" }}
      >
        {activeTool.icon}
        {/* Small dropdown arrow indicator */}
        {hasMultiple && (
          <span
            onClick={handleArrowClick}
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 0,
              height: 0,
              borderLeft: "3px solid transparent",
              borderRight: "3px solid transparent",
              borderTop: "3px solid rgba(236,227,213,0.35)",
              cursor: "pointer",
            }}
          />
        )}
      </button>

      {/* Dropdown popover — uses position:fixed to escape overflow:hidden parents */}
      {open && hasMultiple && (
        <div
          ref={dropdownRef}
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={() => {
            timeoutRef.current = setTimeout(() => setOpen(false), 300);
          }}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            background: "#1e1e22",
            border: "0.667px solid rgba(236,227,213,0.12)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
            padding: "4px 0",
            zIndex: 9999,
            minWidth: 140,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {group.tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolPick(tool.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background:
                  tool.id === currentTool
                    ? "rgba(196,123,58,0.12)"
                    : "transparent",
                color:
                  tool.id === currentTool
                    ? "#c47b3a"
                    : "rgba(236,227,213,0.65)",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: "-0.01em",
                textAlign: "left",
                transition: "background 80ms ease",
              }}
              onMouseEnter={(e) => {
                if (tool.id !== currentTool) {
                  e.currentTarget.style.background = "rgba(236,227,213,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  tool.id === currentTool
                    ? "rgba(196,123,58,0.12)"
                    : "transparent";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.8 }}>
                {tool.icon}
              </span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Sidebar ───

export default function LeftSidebar({
  activeTool: controlledTool,
  onToolChange,
  onDeleteAll,
  onToggleVisibility,
  drawingsVisible = true,
  magnetEnabled = false,
  onToggleMagnet,
  stayInDrawingMode = true,
  onToggleStayInDrawingMode,
}: LeftSidebarProps) {
  const [internalTool, setInternalTool] = useState<DrawingTool>("crosshair");
  const currentTool = controlledTool ?? internalTool;

  const handleToolClick = (tool: DrawingTool) => {
    setInternalTool(tool);
    onToolChange?.(tool);
  };

  // ─── Tool Groups (TradingView-style grouping) ───
  const toolGroups: ToolGroup[] = [
    {
      // Navigation — single tool, no dropdown
      tools: [
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
      ],
    },
    {
      // Lines — grouped with dropdown
      tools: [
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
          id: "vline",
          label: "Vertical Line",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1={12} y1={2} x2={12} y2={22} />
            </svg>
          ),
        },
        {
          id: "ray",
          label: "Ray",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1={4} y1={20} x2={20} y2={4} />
              <polyline points="14,4 20,4 20,10" />
            </svg>
          ),
        },
        {
          id: "arrow",
          label: "Arrow",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1={4} y1={20} x2={18} y2={6} />
              <polyline points="12,6 18,6 18,12" />
            </svg>
          ),
        },
        {
          id: "extendedline",
          label: "Extended Line",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1={2} y1={22} x2={22} y2={2} />
              <circle cx={8} cy={16} r={2} />
              <circle cx={16} cy={8} r={2} />
            </svg>
          ),
        },
      ],
    },
    {
      // Shapes — grouped with dropdown
      tools: [
        {
          id: "rectangle",
          label: "Rectangle",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x={4} y={6} width={16} height={12} rx={1} />
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
      ],
    },
    {
      // Analysis — grouped with dropdown
      tools: [
        {
          id: "fib",
          label: "Fibonacci",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1={2} y1={4} x2={22} y2={4} />
              <line x1={2} y1={9} x2={22} y2={9} strokeDasharray="3,2" />
              <line x1={2} y1={14} x2={22} y2={14} strokeDasharray="3,2" />
              <line x1={2} y1={20} x2={22} y2={20} />
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
      ],
    },
    {
      // Annotations — grouped with dropdown
      tools: [
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
          id: "brush",
          label: "Brush",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3,20 Q6,14 10,12 Q14,10 18,4" strokeLinecap="round" />
            </svg>
          ),
        },
      ],
    },
    {
      // Utility — single tool, no dropdown
      tools: [
        {
          id: "eraser",
          label: "Eraser",
          icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20,20 L9,20 L3,14 L14,3 L21,10 Z" />
              <line x1={9} y1={20} x2={14} y2={15} />
            </svg>
          ),
        },
      ],
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
        overflowY: "auto",
        overflowX: "visible",
      }}
    >
      {toolGroups.map((group, gi) => (
        <div key={gi} style={{ display: "contents" }}>
          {gi > 0 && (
            <div style={{ width: "60%", height: 1, background: "rgba(236,227,213,0.08)", margin: "4px 0" }} />
          )}
          <ToolGroupButton
            group={group}
            currentTool={currentTool}
            onToolSelect={handleToolClick}
          />
        </div>
      ))}

      {/* Magnet */}
      <div style={{ width: "60%", height: 1, background: "rgba(236,227,213,0.08)", margin: "4px 0" }} />
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

      {/* Stay in Drawing Mode toggle */}
      <button
        className={`toolbar-btn${stayInDrawingMode ? " active" : ""}`}
        onClick={onToggleStayInDrawingMode}
        title={stayInDrawingMode ? "Drawing mode: Stay (click to toggle)" : "Drawing mode: Single-use (click to toggle)"}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          {stayInDrawingMode ? (
            <>
              <rect x={6} y={11} width={12} height={9} rx={2} />
              <path d="M8,11 V7 a4,4,0,0,1,8,0 V11" />
            </>
          ) : (
            <>
              <rect x={6} y={11} width={12} height={9} rx={2} />
              <path d="M8,11 V9 a4,4,0,0,1,8,0 V9" />
              <path d="M16,9 L18,7" />
            </>
          )}
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
