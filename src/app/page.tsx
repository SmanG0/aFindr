"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Chart from "@/components/Chart/Chart";
import type { ChartAppearance } from "@/components/Chart/Chart";
import DrawingOverlay from "@/components/Chart/DrawingOverlay";
import { useDrawings } from "@/hooks/useDrawings";
import type { Drawing, DrawingPoint } from "@/hooks/useDrawings";
import DrawingEditModal from "@/components/Chart/DrawingEditModal";
import PriceScalePlusButton from "@/components/Chart/PriceScalePlusButton";
import TimezoneSelector from "@/components/Chart/TimezoneSelector";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import Navbar1 from "@/components/Navbar1/Navbar1";
import Navbar2 from "@/components/Navbar2/Navbar2";
import LeftSidebar from "@/components/LeftSidebar/LeftSidebar";
import type { DrawingTool } from "@/components/LeftSidebar/LeftSidebar";
// FloatingTradeWidget removed - trade buttons now live in Navbar2
import PositionsPanel from "@/components/PositionsPanel/PositionsPanel";
import { BROKER_LIST } from "@/components/PositionsPanel/PositionsPanel";
import type { BrokerData } from "@/components/PositionsPanel/PositionsPanel";
import ReplayControls from "@/components/ReplayControls/ReplayControls";
import CopilotOverlay from "@/components/CopilotOverlay/CopilotOverlay";
import SymbolsSearch from "@/components/SymbolsSearch/SymbolsSearch";
import RiskManagement from "@/components/RiskManagement/RiskManagement";
import SettingsPage from "@/components/SettingsPage/SettingsPage";
import NewsPage from "@/components/NewsPage/NewsPage";
import StatusBar from "@/components/StatusBar/StatusBar";
// BrokerStrip removed — broker info now integrated into bottom panel Broker tab
import type { AppPage } from "@/components/PageNav/PageNav";
import DashboardPage from "@/components/DashboardPage/DashboardPage";
import PortfolioPage from "@/components/PortfolioPage/PortfolioPage";
import AlphaPlayground from "@/components/AlphaPlayground/AlphaPlayground";
import AlphyCompanion from "@/components/AlphyCompanion/AlphyCompanion";
import { useTradingEngine } from "@/hooks/useTradingEngine";
import { sendChatMessage, fetchOHLCV, fetchTicks, syncFullState, takeSnapshot } from "@/lib/api";
// NOTE: useAgentStream added as part of Agent SDK + SSE migration.
//       Provides real-time streaming chat via POST /api/chat/stream.
//       Original REST sendChatMessage is preserved as fallback.
import { useAgentStream } from "@/hooks/useAgentStream";
import type { DoneEvent } from "@/hooks/useAgentStream";
import type {
  Candle,
  Tick,
  Trade,
  BacktestMetrics,
  ChatMessage,
  PineScriptResult,
  ReplayState,
  RiskSettings,
  AppSettings,
  MonteCarloResult,
  WalkForwardResult,
  TradeAnalysisResult,
} from "@/lib/types";
import {
  type IndicatorConfig,
  type IndicatorResult,
  type IndicatorType,
  computeIndicator,
  createIndicatorConfig,
} from "@/lib/indicators";
import { applyTheme, isLightTheme } from "@/lib/theme";
import IndicatorSearchModal from "@/components/IndicatorSearch/IndicatorSearchModal";
import IndicatorEditModal from "@/components/IndicatorSearch/IndicatorEditModal";
import ScriptOverlay from "@/components/Chart/ScriptOverlay";
import { useChartScripts } from "@/hooks/useChartScripts";
import type { ChartScript } from "@/lib/chart-scripts";

const SETTINGS_STORAGE_KEY = "afindr_app_settings";

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark-amber",
  broker: "egm",
  brokerAccountId: "EGM-2847593",
  fundingMethod: "mpesa",
  currency: "KES",
  language: "en",
  marketRegion: "ke",
  oneClickTrading: false,
  tradeExecutionSound: true,
  showBuySellButtons: false,
  showPositionsOnChart: true,
  reversePositionButton: false,
  showPnlOnChart: true,
  defaultOrderType: "market",
  defaultLotSize: 100,
  showNotifications: true,
  notificationDuration: 3,
  pushNotifications: true,
  smsAlerts: false,
  smsPhone: "+254",
  showTradeHistoryOnChart: false,
  bigLotThreshold: 10,
  compactMode: false,
};

// BROKERS_MAP removed — now using BROKER_LIST from PositionsPanel

// ═══════════════════════════════════════════════
// BROKER SELECTION MODAL (TradingView-style)
// ═══════════════════════════════════════════════
function BrokerSelectionModal({
  activeBrokerId,
  onSelectBroker,
  onClose,
}: {
  activeBrokerId: string;
  onSelectBroker: (id: string) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const filteredBrokers = searchQuery
    ? BROKER_LIST.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : BROKER_LIST;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "min(720px, 90vw)",
          maxHeight: "80vh",
          borderRadius: 16,
          background: "rgba(30,27,23,0.98)",
          border: "1px solid rgba(236,227,213,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "20px 24px 16px", flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Trade with your broker
          </h2>
          <div className="flex items-center" style={{ gap: 12 }}>
            {/* Search input */}
            <div style={{ position: "relative" }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search brokers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "rgba(236,227,213,0.05)",
                  border: "1px solid rgba(236,227,213,0.1)",
                  borderRadius: 8,
                  padding: "6px 10px 6px 28px",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  width: 180,
                  outline: "none",
                }}
              />
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(236,227,213,0.06)",
                border: "none", cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 100ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Broker grid */}
        <div style={{ padding: "0 24px 24px", overflow: "auto", flex: 1 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 10,
          }}>
            {filteredBrokers.map((broker: BrokerData) => {
              const isActive = activeBrokerId === broker.id;
              return (
                <button
                  key={broker.id}
                  onClick={() => onSelectBroker(broker.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "16px 12px 14px",
                    borderRadius: 12,
                    background: isActive ? "rgba(236,227,213,0.08)" : "rgba(236,227,213,0.025)",
                    border: isActive ? "1px solid var(--accent)" : "1px solid rgba(236,227,213,0.08)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; e.currentTarget.style.borderColor = "rgba(236,227,213,0.15)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(236,227,213,0.025)"; e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; } }}
                >
                  {/* Featured badge */}
                  {broker.featured && (
                    <span style={{
                      position: "absolute", top: 6, left: 6,
                      fontSize: 8, fontWeight: 700,
                      color: "#fff",
                      background: "rgba(59,130,246,0.8)",
                      padding: "1px 5px",
                      borderRadius: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      Featured
                    </span>
                  )}

                  {/* Connected indicator */}
                  {isActive && (
                    <span style={{
                      position: "absolute", top: 6, right: 6,
                      width: 6, height: 6, borderRadius: "50%",
                      background: "var(--buy)",
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: broker.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: "#fff",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {broker.iconLetters}
                  </div>

                  {/* Name */}
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: "var(--text-primary)",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}>
                    {broker.name}
                  </span>

                  {/* Rating */}
                  {broker.rating && (
                    <span style={{
                      fontSize: 10, color: "var(--text-muted)",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {broker.rating}
                    </span>
                  )}

                  {/* Paper trading subtitle */}
                  {broker.id === "paper" && (
                    <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.2, marginTop: -4 }}>
                      Brokerage simulator
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  // ═══════════════════════════════════════════════
  // PAGE NAVIGATION
  // ═══════════════════════════════════════════════
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [hydrated, setHydrated] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Redirect to landing if onboarding not completed
    try {
      const onboarding = localStorage.getItem("afindr_onboarding");
      if (!onboarding || !JSON.parse(onboarding).completed) {
        window.location.replace("/landing");
        return;
      }
      const parsed = JSON.parse(onboarding);
      if (parsed.name) setUserName(parsed.name);
    } catch {
      window.location.replace("/landing");
      return;
    }

    const saved = localStorage.getItem("afindr_current_page");
    if (saved === "trade" || saved === "dashboard" || saved === "portfolio" || saved === "news" || saved === "alpha" || saved === "settings") {
      setCurrentPage(saved as AppPage);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("afindr_current_page", currentPage);
    }
  }, [currentPage, hydrated]);

  // Persist symbol and interval across reloads
  useEffect(() => {
    localStorage.setItem("afindr_symbol", symbol);
  }, [symbol]);

  useEffect(() => {
    localStorage.setItem("afindr_interval", interval);
  }, [interval]);

  // ═══════════════════════════════════════════════
  // DATA STATE
  // ═══════════════════════════════════════════════
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbol, setSymbol] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("afindr_symbol") || "NQ=F";
    }
    return "NQ=F";
  });
  const [interval, setInterval] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("afindr_interval") || "1d";
    }
    return "1d";
  });

  // Backtest state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [equityCurve, setEquityCurve] = useState<{ time: number; value: number }[]>([]);
  const [strategyName, setStrategyName] = useState<string>("");
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [walkForwardResult, setWalkForwardResult] = useState<WalkForwardResult | null>(null);
  const [tradeAnalysisResult, setTradeAnalysisResult] = useState<TradeAnalysisResult | null>(null);

  // Chat / AI Copilot state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // NOTE: Agent SDK + SSE streaming hook. Provides real-time token streaming.
  //       Falls back to REST sendChatMessage if streaming fails.
  const agentStream = useAgentStream();

  // Update the streaming placeholder message with live text as tokens arrive
  useEffect(() => {
    if (agentStream.isStreaming && agentStream.streamingText) {
      setMessages((prev) =>
        prev.map((m) =>
          m.isStreaming ? { ...m, content: agentStream.streamingText } : m
        )
      );
    }
  }, [agentStream.streamingText, agentStream.isStreaming]);

  // Alphy welcome notification after onboarding
  const [welcomeToast, setWelcomeToast] = useState<{ name: string; preview: string } | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const welcomed = localStorage.getItem("afindr_onboarding_welcomed");
    if (welcomed) return;
    try {
      const onboarding = JSON.parse(localStorage.getItem("afindr_onboarding") || "{}");
      if (!onboarding.completed) return;
      localStorage.setItem("afindr_onboarding_welcomed", "true");
      const name = onboarding.name || "there";
      const experience = onboarding.experience || "beginner";
      const markets = (onboarding.markets || []).map((m: string) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ");

      const tips: Record<string, string> = {
        beginner: "I'd recommend starting with the Dashboard to get a feel for the markets, then try asking me to explain any chart pattern or indicator you're curious about.",
        intermediate: "Try asking me to backtest a strategy you've been using -- I can run Monte Carlo simulations and walk-forward analysis to validate your edge.",
        advanced: "You've got full access to backtesting, walk-forward optimization, Monte Carlo sims, and custom PineScript generation. Ask me anything.",
      };

      const welcome: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Welcome to aFindr, ${name}. I'm Alphy, your AI trading copilot.\n\nI see you're interested in ${markets || "the markets"} -- great choices. ${tips[experience] || tips.beginner}\n\nA few things I can help with:\n- Backtest any strategy with a single prompt\n- Generate PineScript indicators and overlays\n- Run Monte Carlo simulations on your results\n- Analyze trade patterns and optimal entry times\n\nWhat would you like to explore first?`,
        timestamp: Date.now(),
      };
      setMessages([welcome]);

      // Show toast notification bubble instead of opening panel
      setTimeout(() => {
        setWelcomeToast({ name, preview: `Hey ${name}, I'm Alphy -- your AI trading copilot. Tap to chat.` });
      }, 800);

      // Auto-dismiss after 12 seconds
      setTimeout(() => setWelcomeToast(null), 13000);
    } catch { /* ignore */ }
  }, [hydrated]);

  // Tick data for tick-by-tick replay
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [tickMode, setTickMode] = useState(false);

  // Replay state
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    currentBarIndex: 0,
    totalBars: 0,
    speed: 1,
    progress: 0,
    tickMode: false,
    currentTickIndex: 0,
    totalTicks: 0,
  });
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════
  // TRADING ENGINE (simulated positions, orders, P&L)
  // ═══════════════════════════════════════════════
  const tradingEngine = useTradingEngine();

  // Update unrealized P&L as price changes
  const currentPrice = useMemo(() => {
    if (candles.length === 0) return 0;
    return candles[candles.length - 1]?.close ?? 0;
  }, [candles]);

  useEffect(() => {
    if (currentPrice > 0) {
      tradingEngine.updatePrices(currentPrice, symbol);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice]);

  // One-time full sync to backend DB on app load
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || syncedRef.current) return;
    syncedRef.current = true;
    const state = tradingEngine.accountState;
    syncFullState({
      balance: state.balance,
      equity: state.equity,
      unrealizedPnl: state.unrealizedPnl,
      positions: state.positions as unknown as Array<Record<string, unknown>>,
      tradeHistory: state.tradeHistory as unknown as Array<Record<string, unknown>>,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Periodic account snapshot every 5 minutes
  useEffect(() => {
    if (!hydrated) return;
    const interval = globalThis.setInterval(() => {
      const state = tradingEngine.accountState;
      takeSnapshot({
        balance: state.balance,
        equity: state.equity,
        unrealizedPnl: state.unrealizedPnl,
        positionCount: state.positions.length,
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // ═══════════════════════════════════════════════
  // UI PANEL STATE (overlays, sidebars, modals)
  // ═══════════════════════════════════════════════
  const [showSymbols, setShowSymbols] = useState(false);
  const [showRiskMgmt, setShowRiskMgmt] = useState(false);
  const [showIndicatorSearch, setShowIndicatorSearch] = useState(false);
  const [indicatorConfigs, setIndicatorConfigs] = useState<IndicatorConfig[]>([]);
  const [editIndicatorConfig, setEditIndicatorConfig] = useState<IndicatorConfig | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [stayInDrawingMode, setStayInDrawingMode] = useState(false);
  const [chartTheme, setChartTheme] = useState<"dark" | "light">("dark");
  const [selectMode, setSelectMode] = useState<"date" | "random" | "bar" | null>(null);
  const [showStrategyTester, setShowStrategyTester] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showAlphySidePanel, setShowAlphySidePanel] = useState(false);
  const [showBrokerSelector, setShowBrokerSelector] = useState(false);
  const [activeBrokerId, setActiveBrokerId] = useState("paper");

  // Risk settings
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    maxOpenPositions: null,
    allowedSymbols: [],
    requireSlTp: false,
    maxLossPerTradePct: null,
    presetSlPct: null,
    presetTpPct: null,
  });

  // App settings (persisted, theme applied on change)
  const [appSettings, setAppSettingsState] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        setAppSettingsState((prev) => ({ ...DEFAULT_APP_SETTINGS, ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyTheme(appSettings.theme);
  }, [appSettings.theme]);

  const setAppSettings = useCallback((next: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    setAppSettingsState((prev) => {
      const nextVal = typeof next === "function" ? next(prev) : next;
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextVal));
      } catch {
        /* ignore */
      }
      return nextVal;
    });
  }, []);

  useEffect(() => {
    applyTheme(appSettings.theme);
  }, [appSettings.theme]);

  useEffect(() => {
    setChartTheme(isLightTheme(appSettings.theme) ? "light" : "dark");
  }, [appSettings.theme]);

  // ═══════════════════════════════════════════════
  // DRAWING TOOLS
  // ═══════════════════════════════════════════════
  const {
    drawings,
    pendingPoint,
    selectedId,
    brushPoints,
    handleDrawingClick,
    removeDrawing,
    clearAllDrawings,
    cancelPending,
    selectDrawing,
    updateDrawing,
    startBrush,
    moveBrush,
    endBrush,
  } = useDrawings();

  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesApiRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [mousePoint, setMousePoint] = useState<DrawingPoint | null>(null);
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance | undefined>(undefined);
  const [editModalDrawing, setEditModalDrawing] = useState<{ drawing: Drawing; position: { x: number; y: number } } | null>(null);
  const [chartTimezone, setChartTimezone] = useState("auto");

  // Track mouse position for drawing preview
  useEffect(() => {
    if (drawingTool === "crosshair" || !chartApiRef.current || !seriesApiRef.current) return;

    const chart = chartApiRef.current;
    const series = seriesApiRef.current;

    const handler = (param: { time?: unknown; sourceEvent?: { clientY: number; clientX: number } }) => {
      if (!param.time || !param.sourceEvent) {
        setMousePoint(null);
        return;
      }
      const rect = chart.chartElement().getBoundingClientRect();
      const price = series.coordinateToPrice(param.sourceEvent.clientY - rect.top);
      if (price !== null) {
        setMousePoint({ time: param.time as number, price });
      }
    };

    chart.subscribeCrosshairMove(handler);
    return () => {
      try { chart.unsubscribeCrosshairMove(handler); } catch { /* disposed */ }
    };
  }, [drawingTool]);

  // Brush tool mouse event wiring
  useEffect(() => {
    if (drawingTool !== "brush" || !chartApiRef.current || !seriesApiRef.current) return;
    const chartEl = chartApiRef.current.chartElement();
    const chart = chartApiRef.current;
    const series = seriesApiRef.current;
    let isBrushing = false;

    const getPoint = (e: MouseEvent): DrawingPoint | null => {
      const rect = chartEl.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const time = chart.timeScale().coordinateToTime(localX);
      const price = series.coordinateToPrice(localY);
      if (time === null || price === null) return null;
      return { time: time as number, price };
    };

    const onDown = (e: MouseEvent) => {
      const pt = getPoint(e);
      if (pt) { isBrushing = true; startBrush(pt); }
    };
    const onMove = (e: MouseEvent) => {
      if (!isBrushing) return;
      const pt = getPoint(e);
      if (pt) moveBrush(pt);
    };
    const onUp = () => {
      if (!isBrushing) return;
      isBrushing = false;
      const result = endBrush();
      if (result === "completed" && !stayInDrawingMode) {
        setDrawingTool("crosshair");
      }
    };

    chartEl.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      chartEl.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drawingTool, startBrush, moveBrush, endBrush, stayInDrawingMode]);

  const handleDrawingChartClick = useCallback((time: number, price: number) => {
    if (drawingTool === "crosshair" || drawingTool === "brush") return;
    if (drawingTool === "eraser") return; // eraser handled by DrawingOverlay
    const result = handleDrawingClick(drawingTool, { time, price });
    if (result === "completed" && !stayInDrawingMode) {
      setDrawingTool("crosshair");
    }
  }, [drawingTool, handleDrawingClick, stayInDrawingMode]);

  // ═══════════════════════════════════════════════
  // INDICATORS
  // ═══════════════════════════════════════════════
  const indicatorResults: IndicatorResult[] = useMemo(() => {
    if (candles.length === 0 || indicatorConfigs.length === 0) return [];
    return indicatorConfigs
      .filter((c) => c.visible)
      .map((c) => computeIndicator(c, candles))
      .filter((r): r is IndicatorResult => r !== null);
  }, [candles, indicatorConfigs]);

  const handleAddIndicator = useCallback((type: IndicatorType, params?: Record<string, number>) => {
    const config = createIndicatorConfig(type, params ? { params } : undefined);
    setIndicatorConfigs((prev) => [...prev, config]);
  }, []);

  const handleRemoveIndicator = useCallback((id: string) => {
    setIndicatorConfigs((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleToggleIndicator = useCallback((id: string) => {
    setIndicatorConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  }, []);

  const handleUpdateIndicator = useCallback((id: string, updates: Partial<IndicatorConfig>) => {
    setIndicatorConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  // ═══════════════════════════════════════════════
  // CHART SCRIPTS (custom visuals from Alphy)
  // ═══════════════════════════════════════════════
  const {
    scriptResults,
    addScript: addChartScript,
  } = useChartScripts(candles);

  const handleChartReady = useCallback((chart: IChartApi, series: ISeriesApi<"Candlestick">) => {
    chartApiRef.current = chart;
    seriesApiRef.current = series;
    // Capture the chart container element for PriceScalePlusButton
    try {
      chartContainerRef.current = chart.chartElement().parentElement as HTMLDivElement;
    } catch { /* chart may be disposed */ }
  }, []);

  const handleDrawingDoubleClick = useCallback((drawing: Drawing, position: { x: number; y: number }) => {
    setEditModalDrawing({ drawing, position });
  }, []);

  const handleEditModalClose = useCallback(() => {
    setEditModalDrawing(null);
  }, []);

  // ═══════════════════════════════════════════════
  // RESIZABLE BOTTOM PANEL
  // ═══════════════════════════════════════════════
  const [bottomHeight, setBottomHeight] = useState(200);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(75, Math.min(window.innerHeight * 0.9, startHeightRef.current + delta));
      setBottomHeight(newHeight);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = bottomHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  // ═══════════════════════════════════════════════
  // DATA LOADING LOGIC
  // ═══════════════════════════════════════════════
  const getPeriodForInterval = (iv: string): string => {
    switch (iv) {
      case "1m": return "1d";
      case "5m": return "5d";
      case "15m": return "5d";
      case "30m": return "1mo";
      case "1h": return "6mo";
      case "4h": return "2y";
      case "1d": return "2y";
      case "1wk": return "5y";
      default: return "1y";
    }
  };

  const getIntervalSeconds = useCallback((iv: string): number => {
    switch (iv) {
      case "1m": return 60;
      case "5m": return 300;
      case "15m": return 900;
      case "30m": return 1800;
      case "1h": return 3600;
      case "4h": return 14400;
      case "1d": return 86400;
      case "1wk": return 604800;
      default: return 60;
    }
  }, []);

  const buildCandlesFromTicks = useCallback((
    tickData: Tick[],
    upToTickIndex: number,
    intervalSec: number,
  ): Candle[] => {
    if (tickData.length === 0 || upToTickIndex <= 0) return [];
    const endIdx = Math.min(upToTickIndex, tickData.length);
    const result: Candle[] = [];
    let currentBarStart = Math.floor(tickData[0].time / intervalSec) * intervalSec;
    let open = tickData[0].price;
    let high = tickData[0].price;
    let low = tickData[0].price;
    let close = tickData[0].price;
    let volume = 0;

    for (let i = 0; i < endIdx; i++) {
      const tick = tickData[i];
      const barStart = Math.floor(tick.time / intervalSec) * intervalSec;
      if (barStart !== currentBarStart && volume > 0) {
        result.push({ time: currentBarStart, open, high, low, close, volume });
        currentBarStart = barStart;
        open = tick.price; high = tick.price; low = tick.price; close = tick.price;
        volume = tick.size;
      } else {
        high = Math.max(high, tick.price);
        low = Math.min(low, tick.price);
        close = tick.price;
        volume += tick.size;
      }
    }
    if (volume > 0) {
      result.push({ time: currentBarStart, open, high, low, close, volume });
    }
    return result;
  }, []);

  // Load tick data when tick mode is enabled
  useEffect(() => {
    if (!tickMode) { setTicks([]); return; }
    const loadTicks = async () => {
      try {
        const result = await fetchTicks(symbol, undefined, 100000);
        const tickData = result?.ticks ?? [];
        if (tickData.length === 0) {
          // No tick data available — gracefully disable tick mode
          console.warn(`No tick data available for ${symbol}. Tick replay requires tick-level CSV data.`);
          setTickMode(false);
          return;
        }
        setTicks(tickData);
        setReplayState((prev) => ({
          ...prev, tickMode: true, totalTicks: tickData.length,
          currentTickIndex: tickData.length, currentBarIndex: 0, totalBars: 0,
          progress: 100, isPlaying: false,
        }));
      } catch (err) {
        console.warn("Tick data not available:", err);
        setTickMode(false);
      }
    };
    loadTicks();
  }, [tickMode, symbol]);

  // When tick mode is turned off, restore normal candle state
  useEffect(() => {
    if (!tickMode && candles.length > 0) {
      setReplayState((prev) => ({
        ...prev, tickMode: false, totalBars: candles.length,
        currentBarIndex: candles.length, currentTickIndex: 0, totalTicks: 0,
        progress: 100, isPlaying: false,
      }));
    }
  }, [tickMode, candles.length]);

  // Load OHLCV data on symbol/interval change
  // Preserves replay position (by timestamp) when switching intervals during a backtest
  const replayTimeRef = useRef<number | null>(null);
  useEffect(() => {
    // Capture the current replay timestamp before loading new data
    if (candles.length > 0 && replayState.currentBarIndex < candles.length) {
      replayTimeRef.current = candles[replayState.currentBarIndex]?.time ?? null;
    } else {
      replayTimeRef.current = null;
    }

    const loadData = async () => {
      try {
        const result = await fetchOHLCV({ symbol, period: getPeriodForInterval(interval), interval });
        const candleData = result?.candles ?? [];
        setCandles(candleData);
        if (!tickMode) {
          // Try to restore replay position by timestamp
          let newBarIndex = candleData.length;
          if (replayTimeRef.current !== null && candleData.length > 0) {
            const targetTime = replayTimeRef.current;
            const idx = candleData.findIndex((c: Candle) => c.time >= targetTime);
            if (idx >= 0) {
              newBarIndex = idx;
            }
          }
          const atEnd = newBarIndex >= candleData.length;
          setReplayState((prev) => ({
            ...prev, totalBars: candleData.length,
            currentBarIndex: atEnd ? candleData.length : newBarIndex,
            isPlaying: false,
            progress: atEnd ? 100 : (newBarIndex / candleData.length) * 100,
            tickMode: false, currentTickIndex: 0, totalTicks: 0,
          }));
        }
      } catch (err) { console.error("Failed to fetch data:", err); }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  // ═══════════════════════════════════════════════
  // LOAD SAVED STRATEGY
  // ═══════════════════════════════════════════════
  const handleLoadStrategy = useCallback((data: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    setStrategyName(d.name ?? "");

    // Map metrics (snake_case from rerun result) → BacktestMetrics (camelCase)
    const rawMetrics = (d.metrics || {}) as Record<string, unknown>;
    setMetrics({
      totalTrades: (rawMetrics.total_trades ?? rawMetrics.totalTrades ?? 0) as number,
      winRate: (rawMetrics.win_rate ?? rawMetrics.winRate ?? 0) as number,
      lossRate: (rawMetrics.loss_rate ?? rawMetrics.lossRate ?? 0) as number,
      totalReturn: (rawMetrics.total_return ?? rawMetrics.totalReturn ?? 0) as number,
      totalReturnPct: (rawMetrics.total_return_pct ?? rawMetrics.totalReturnPct ?? 0) as number,
      maxDrawdown: (rawMetrics.max_drawdown ?? rawMetrics.maxDrawdown ?? 0) as number,
      maxDrawdownPct: (rawMetrics.max_drawdown_pct ?? rawMetrics.maxDrawdownPct ?? 0) as number,
      maxConsecutiveLosses: (rawMetrics.max_consecutive_losses ?? rawMetrics.maxConsecutiveLosses ?? 0) as number,
      maxConsecutiveWins: (rawMetrics.max_consecutive_wins ?? rawMetrics.maxConsecutiveWins ?? 0) as number,
      profitFactor: (rawMetrics.profit_factor ?? rawMetrics.profitFactor ?? 0) as number,
      sharpeRatio: (rawMetrics.sharpe_ratio ?? rawMetrics.sharpeRatio ?? 0) as number,
      sortinoRatio: (rawMetrics.sortino_ratio ?? rawMetrics.sortinoRatio) as number | undefined,
      calmarRatio: (rawMetrics.calmar_ratio ?? rawMetrics.calmarRatio) as number | undefined,
      recoveryFactor: (rawMetrics.recovery_factor ?? rawMetrics.recoveryFactor) as number | undefined,
      expectancy: (rawMetrics.expectancy ?? rawMetrics.expectancy) as number | undefined,
      expectancyRatio: (rawMetrics.expectancy_ratio ?? rawMetrics.expectancyRatio) as number | undefined,
      payoffRatio: (rawMetrics.payoff_ratio ?? rawMetrics.payoffRatio) as number | undefined,
      avgWin: (rawMetrics.avg_win ?? rawMetrics.avgWin ?? 0) as number,
      avgLoss: (rawMetrics.avg_loss ?? rawMetrics.avgLoss ?? 0) as number,
    });

    // Map trades (snake_case) → Trade[] for chart markers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTrades = ((d.trades || []) as any[]).map((t: any) => ({
      id: (t.id ?? 0) as number,
      instrument: (t.instrument ?? "N/A") as string,
      side: (t.side ?? "long") as "long" | "short",
      size: (t.size ?? 1) as number,
      entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
      exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
      entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
      exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
      stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
      takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
      pnl: (t.pnl ?? 0) as number,
      pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
      commission: (t.commission ?? 0) as number,
    }));
    setTrades(rawTrades);

    // Map equity curve
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawEquity = ((d.equity_curve || d.equityCurve || []) as any[]).map((e: any) => ({
      time: (e.time ?? 0) as number,
      value: (e.value ?? 0) as number,
    }));
    setEquityCurve(rawEquity);

    // Clear walk-forward/analysis (not part of rerun)
    setMonteCarloResult(null);
    setWalkForwardResult(null);
    setTradeAnalysisResult(null);

    // Switch chart to the strategy's symbol/interval if different
    if (d.symbol && d.symbol !== symbol) {
      setSymbol(d.symbol);
    }
    if (d.interval && d.interval !== interval) {
      setInterval(d.interval);
    }

    // Open bottom panel with strategy report active
    setShowBottomPanel(true);
    setShowStrategyTester(true);
  }, [symbol, interval]);

  // ═══════════════════════════════════════════════
  // CHAT / AI COPILOT
  // ═══════════════════════════════════════════════
  const handleSubmit = useCallback(
    async (message: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "user", content: message, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      try {
        const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
        const response = await sendChatMessage({ message, symbol, timeframe: interval, conversationHistory });

        let backtestResult = undefined;
        if (response.backtestResult) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const br = response.backtestResult as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawMetrics = (br.metrics || {}) as any;
          const mappedMetrics: BacktestMetrics = {
            totalTrades: (rawMetrics.total_trades ?? rawMetrics.totalTrades ?? 0) as number,
            winRate: (rawMetrics.win_rate ?? rawMetrics.winRate ?? 0) as number,
            lossRate: (rawMetrics.loss_rate ?? rawMetrics.lossRate ?? 0) as number,
            totalReturn: (rawMetrics.total_return ?? rawMetrics.totalReturn ?? 0) as number,
            totalReturnPct: (rawMetrics.total_return_pct ?? rawMetrics.totalReturnPct ?? 0) as number,
            maxDrawdown: (rawMetrics.max_drawdown ?? rawMetrics.maxDrawdown ?? 0) as number,
            maxDrawdownPct: (rawMetrics.max_drawdown_pct ?? rawMetrics.maxDrawdownPct ?? 0) as number,
            maxConsecutiveLosses: (rawMetrics.max_consecutive_losses ?? rawMetrics.maxConsecutiveLosses ?? 0) as number,
            maxConsecutiveWins: (rawMetrics.max_consecutive_wins ?? rawMetrics.maxConsecutiveWins ?? 0) as number,
            profitFactor: (rawMetrics.profit_factor ?? rawMetrics.profitFactor ?? 0) as number,
            sharpeRatio: (rawMetrics.sharpe_ratio ?? rawMetrics.sharpeRatio ?? 0) as number,
            sortinoRatio: (rawMetrics.sortino_ratio ?? rawMetrics.sortinoRatio) as number | undefined,
            calmarRatio: (rawMetrics.calmar_ratio ?? rawMetrics.calmarRatio) as number | undefined,
            recoveryFactor: (rawMetrics.recovery_factor ?? rawMetrics.recoveryFactor) as number | undefined,
            expectancy: (rawMetrics.expectancy ?? rawMetrics.expectancy) as number | undefined,
            expectancyRatio: (rawMetrics.expectancy_ratio ?? rawMetrics.expectancyRatio) as number | undefined,
            payoffRatio: (rawMetrics.payoff_ratio ?? rawMetrics.payoffRatio) as number | undefined,
            avgWin: (rawMetrics.avg_win ?? rawMetrics.avgWin ?? 0) as number,
            avgLoss: (rawMetrics.avg_loss ?? rawMetrics.avgLoss ?? 0) as number,
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawTrades = ((br.trades || []) as any[]).map((t: any) => ({
            id: (t.id ?? 0) as number, instrument: (t.instrument ?? "N/A") as string,
            side: (t.side ?? "long") as "long" | "short", size: (t.size ?? 1) as number,
            entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
            exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
            entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
            exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
            stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
            takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
            pnl: (t.pnl ?? 0) as number, pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
            commission: (t.commission ?? 0) as number,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawEquity = ((br.equity_curve || br.equityCurve || []) as any[]).map((e: any) => ({
            time: (e.time ?? 0) as number, value: (e.value ?? 0) as number,
          }));
          backtestResult = {
            trades: rawTrades, equityCurve: rawEquity, metrics: mappedMetrics,
            strategyName: (br.strategy_name ?? br.strategyName ?? "") as string,
            strategyDescription: (br.strategy_description ?? br.strategyDescription ?? "") as string,
          };
          setTrades(rawTrades);
          setMetrics(mappedMetrics);
          setEquityCurve(rawEquity);
          setStrategyName(backtestResult.strategyName);
          setShowStrategyTester(true);
          setShowBottomPanel(true);
        }
        // Handle PineScript result — extract and attach to message
        let pinescriptResult: PineScriptResult | undefined;
        if (response.pinescript) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ps = response.pinescript as any;
          pinescriptResult = {
            name: (ps.name ?? "Custom Strategy") as string,
            description: (ps.description ?? "") as string,
            parameters: (ps.parameters ?? {}) as Record<string, string>,
            code: (ps.code ?? "") as string,
            script_type: (ps.script_type ?? "strategy") as "strategy" | "indicator",
          };
        }

        // Parse Monte Carlo result
        let parsedMonteCarlo: MonteCarloResult | undefined;
        if (response.monteCarlo) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mc = response.monteCarlo as any;
          parsedMonteCarlo = {
            numSimulations: (mc.num_simulations ?? mc.numSimulations ?? 0) as number,
            numTrades: (mc.num_trades ?? mc.numTrades ?? 0) as number,
            meanReturn: (mc.mean_return ?? mc.meanReturn ?? 0) as number,
            medianReturn: (mc.median_return ?? mc.medianReturn ?? 0) as number,
            stdReturn: (mc.std_return ?? mc.stdReturn ?? 0) as number,
            percentile5: (mc.percentile_5 ?? mc.percentile5 ?? 0) as number,
            percentile25: (mc.percentile_25 ?? mc.percentile25 ?? 0) as number,
            percentile75: (mc.percentile_75 ?? mc.percentile75 ?? 0) as number,
            percentile95: (mc.percentile_95 ?? mc.percentile95 ?? 0) as number,
            meanMaxDrawdown: (mc.mean_max_drawdown ?? mc.meanMaxDrawdown ?? 0) as number,
            medianMaxDrawdown: (mc.median_max_drawdown ?? mc.medianMaxDrawdown ?? 0) as number,
            worstMaxDrawdown: (mc.worst_max_drawdown ?? mc.worstMaxDrawdown ?? 0) as number,
            percentile95Drawdown: (mc.percentile_95_drawdown ?? mc.percentile95Drawdown ?? 0) as number,
            probabilityOfRuin: (mc.probability_of_ruin ?? mc.probabilityOfRuin ?? 0) as number,
            probabilityOfProfit: (mc.probability_of_profit ?? mc.probabilityOfProfit ?? 0) as number,
            equityPercentiles: {
              p5: (mc.equity_percentiles?.p5 ?? mc.equityPercentiles?.p5 ?? []) as number[],
              p25: (mc.equity_percentiles?.p25 ?? mc.equityPercentiles?.p25 ?? []) as number[],
              p50: (mc.equity_percentiles?.p50 ?? mc.equityPercentiles?.p50 ?? []) as number[],
              p75: (mc.equity_percentiles?.p75 ?? mc.equityPercentiles?.p75 ?? []) as number[],
              p95: (mc.equity_percentiles?.p95 ?? mc.equityPercentiles?.p95 ?? []) as number[],
            },
          };
          setMonteCarloResult(parsedMonteCarlo);
        }

        // Parse Walk-Forward result
        let parsedWalkForward: WalkForwardResult | undefined;
        if (response.walkForward) {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const wf = response.walkForward as any;
          parsedWalkForward = {
            numWindows: (wf.num_windows ?? wf.numWindows ?? 0) as number,
            isRatio: (wf.is_ratio ?? wf.isRatio ?? 0) as number,
            windows: ((wf.windows ?? []) as any[]).map((w: any) => ({
              windowIndex: (w.window_index ?? w.windowIndex ?? 0) as number,
              isStart: (w.is_start ?? w.isStart ?? "") as string,
              isEnd: (w.is_end ?? w.isEnd ?? "") as string,
              oosStart: (w.oos_start ?? w.oosStart ?? "") as string,
              oosEnd: (w.oos_end ?? w.oosEnd ?? "") as string,
              isBars: (w.is_bars ?? w.isBars ?? 0) as number,
              oosBars: (w.oos_bars ?? w.oosBars ?? 0) as number,
              isMetrics: (w.is_metrics ?? w.isMetrics ?? {}) as Record<string, number>,
              oosMetrics: (w.oos_metrics ?? w.oosMetrics ?? {}) as Record<string, number>,
              bestParams: (w.best_params ?? w.bestParams ?? {}) as Record<string, number>,
            })),
            aggregateOosMetrics: (wf.aggregate_oos_metrics ?? wf.aggregateOosMetrics ?? {}) as Record<string, number>,
            oosTrades: ((wf.oos_trades ?? wf.oosTrades ?? []) as any[]).map((t: any) => ({
              id: (t.id ?? 0) as number,
              instrument: (t.instrument ?? "N/A") as string,
              side: (t.side ?? "long") as "long" | "short",
              size: (t.size ?? 1) as number,
              entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
              exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
              entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
              exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
              stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
              takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
              pnl: (t.pnl ?? 0) as number,
              pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
              commission: (t.commission ?? 0) as number,
            })),
            oosEquityCurve: ((wf.oos_equity_curve ?? wf.oosEquityCurve ?? []) as any[]).map((e: any) => ({
              time: (e.time ?? 0) as number,
              value: (e.value ?? 0) as number,
            })),
            robustnessRatio: (wf.robustness_ratio ?? wf.robustnessRatio ?? 0) as number,
          };
          /* eslint-enable @typescript-eslint/no-explicit-any */
          setWalkForwardResult(parsedWalkForward);
        }

        // Parse Trade Analysis result
        let parsedTradeAnalysis: TradeAnalysisResult | undefined;
        if (response.tradeAnalysis) {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const ta = response.tradeAnalysis as any;
          parsedTradeAnalysis = {
            totalTradesAnalyzed: (ta.total_trades_analyzed ?? ta.totalTradesAnalyzed ?? 0) as number,
            bestEntryHours: ((ta.best_entry_hours ?? ta.bestEntryHours ?? []) as any[]).map((h: any) => ({
              hour: (h.hour ?? 0) as number,
              avgPnl: (h.avg_pnl ?? h.avgPnl ?? 0) as number,
              tradeCount: (h.trade_count ?? h.tradeCount ?? 0) as number,
              winRate: (h.win_rate ?? h.winRate ?? 0) as number,
            })),
            bestEntryDays: ((ta.best_entry_days ?? ta.bestEntryDays ?? []) as any[]).map((d: any) => ({
              dayName: (d.day_name ?? d.dayName ?? "") as string,
              avgPnl: (d.avg_pnl ?? d.avgPnl ?? 0) as number,
              tradeCount: (d.trade_count ?? d.tradeCount ?? 0) as number,
              winRate: (d.win_rate ?? d.winRate ?? 0) as number,
            })),
            tradeScores: ((ta.trade_scores ?? ta.tradeScores ?? []) as any[]).map((s: any) => ({
              tradeId: (s.trade_id ?? s.tradeId ?? 0) as number,
              score: (s.score ?? 0) as number,
              factors: (s.factors ?? {}) as Record<string, number>,
              pnl: (s.pnl ?? 0) as number,
            })),
            avgScoreWinners: (ta.avg_score_winners ?? ta.avgScoreWinners ?? 0) as number,
            avgScoreLosers: (ta.avg_score_losers ?? ta.avgScoreLosers ?? 0) as number,
            avgAtrBeforeWinners: (ta.avg_atr_before_winners ?? ta.avgAtrBeforeWinners ?? 0) as number,
            avgAtrBeforeLosers: (ta.avg_atr_before_losers ?? ta.avgAtrBeforeLosers ?? 0) as number,
            momentumBeforeWinners: (ta.momentum_before_winners ?? ta.momentumBeforeWinners ?? 0) as number,
            momentumBeforeLosers: (ta.momentum_before_losers ?? ta.momentumBeforeLosers ?? 0) as number,
            avgMaeWinners: (ta.avg_mae_winners ?? ta.avgMaeWinners ?? 0) as number,
            avgMaeLosers: (ta.avg_mae_losers ?? ta.avgMaeLosers ?? 0) as number,
            avgMfeWinners: (ta.avg_mfe_winners ?? ta.avgMfeWinners ?? 0) as number,
            avgMfeLosers: (ta.avg_mfe_losers ?? ta.avgMfeLosers ?? 0) as number,
            avgContinuationAfterWin: (ta.avg_continuation_after_win ?? ta.avgContinuationAfterWin ?? 0) as number,
            avgContinuationAfterLoss: (ta.avg_continuation_after_loss ?? ta.avgContinuationAfterLoss ?? 0) as number,
          };
          /* eslint-enable @typescript-eslint/no-explicit-any */
          setTradeAnalysisResult(parsedTradeAnalysis);
        }

        // Parse chart script results (may be an array from pattern detection tools)
        let parsedChartScript: ChartScript | undefined;
        const chartScriptsArr = (response as any).chartScripts;
        if (Array.isArray(chartScriptsArr)) {
          for (const cs of chartScriptsArr) {
            addChartScript(cs as ChartScript);
          }
          parsedChartScript = chartScriptsArr[0] as ChartScript;
        } else if ((response as any).chartScript) {
          parsedChartScript = (response as any).chartScript as ChartScript;
          addChartScript(parsedChartScript);
        }

        // Parse indicator commands from AI response
        // Format: [INDICATOR:type:param1=val1,param2=val2]
        const indicatorRegex = /\[INDICATOR:(\w+)(?::([^\]]+))?\]/g;
        let match;
        while ((match = indicatorRegex.exec(response.message)) !== null) {
          const indType = match[1] as IndicatorType;
          const paramStr = match[2];
          const params: Record<string, number> = {};
          if (paramStr) {
            for (const p of paramStr.split(",")) {
              const [k, v] = p.split("=");
              if (k && v) params[k.trim()] = parseFloat(v.trim());
            }
          }
          handleAddIndicator(indType, Object.keys(params).length > 0 ? params : undefined);
        }

        // Also detect natural language indicator adds from the message content
        const cleanMessage = response.message.replace(/\[INDICATOR:[^\]]+\]/g, "").trim();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant", content: cleanMessage || response.message,
          timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
          monteCarloResult: parsedMonteCarlo,
          walkForwardResult: parsedWalkForward,
          tradeAnalysisResult: parsedTradeAnalysis,
          chartScriptResult: parsedChartScript,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, symbol, interval, addChartScript, handleAddIndicator]
  );

  // ═══════════════════════════════════════════════
  // STREAMING CHAT (Agent SDK + SSE)
  // NOTE: Added as part of Agent SDK migration. Tries SSE streaming first,
  //       falls back to REST handleSubmit if streaming fails.
  //       Original handleSubmit above is preserved unchanged.
  // ═══════════════════════════════════════════════
  const handleSubmitStreaming = useCallback(
    async (message: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "user", content: message, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
        // Capture news headlines if user is on the news page
        let newsHeadlines: string[] | undefined;
        if (currentPage === "news") {
          const headlineEls = document.querySelectorAll('[data-news-headline]');
          if (headlineEls.length > 0) {
            newsHeadlines = Array.from(headlineEls)
              .map(el => el.getAttribute('data-news-headline') || el.textContent || '')
              .filter(Boolean)
              .slice(0, 20);
          }
        }

        const doneEvent = await agentStream.streamMessage({
          message,
          symbol,
          period: "1y",
          interval,
          conversation_history: conversationHistory,
          current_page: currentPage,
          news_headlines: newsHeadlines,
        });

        if (!doneEvent) {
          // Streaming failed silently — fall back to REST
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          setIsLoading(false);
          handleSubmit(message);
          return;
        }

        // Parse the done event data — same structure as REST response
        // but with snake_case field names (the parsing code handles both)
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const response = {
          message: doneEvent.message || "",
          backtestResult: doneEvent.backtest_result,
          pinescript: doneEvent.pinescript,
          monteCarlo: doneEvent.monte_carlo,
          walkForward: doneEvent.walk_forward,
          tradeAnalysis: doneEvent.trade_analysis,
          chartScripts: doneEvent.chart_scripts || (doneEvent.chart_script ? [doneEvent.chart_script] : null),
        };

        let backtestResult = undefined;
        if (response.backtestResult) {
          const br = response.backtestResult as any;
          const rawMetrics = (br.metrics || {}) as any;
          const mappedMetrics: BacktestMetrics = {
            totalTrades: (rawMetrics.total_trades ?? rawMetrics.totalTrades ?? 0) as number,
            winRate: (rawMetrics.win_rate ?? rawMetrics.winRate ?? 0) as number,
            lossRate: (rawMetrics.loss_rate ?? rawMetrics.lossRate ?? 0) as number,
            totalReturn: (rawMetrics.total_return ?? rawMetrics.totalReturn ?? 0) as number,
            totalReturnPct: (rawMetrics.total_return_pct ?? rawMetrics.totalReturnPct ?? 0) as number,
            maxDrawdown: (rawMetrics.max_drawdown ?? rawMetrics.maxDrawdown ?? 0) as number,
            maxDrawdownPct: (rawMetrics.max_drawdown_pct ?? rawMetrics.maxDrawdownPct ?? 0) as number,
            maxConsecutiveLosses: (rawMetrics.max_consecutive_losses ?? rawMetrics.maxConsecutiveLosses ?? 0) as number,
            maxConsecutiveWins: (rawMetrics.max_consecutive_wins ?? rawMetrics.maxConsecutiveWins ?? 0) as number,
            profitFactor: (rawMetrics.profit_factor ?? rawMetrics.profitFactor ?? 0) as number,
            sharpeRatio: (rawMetrics.sharpe_ratio ?? rawMetrics.sharpeRatio ?? 0) as number,
            sortinoRatio: (rawMetrics.sortino_ratio ?? rawMetrics.sortinoRatio) as number | undefined,
            calmarRatio: (rawMetrics.calmar_ratio ?? rawMetrics.calmarRatio) as number | undefined,
            recoveryFactor: (rawMetrics.recovery_factor ?? rawMetrics.recoveryFactor) as number | undefined,
            expectancy: (rawMetrics.expectancy ?? rawMetrics.expectancy) as number | undefined,
            expectancyRatio: (rawMetrics.expectancy_ratio ?? rawMetrics.expectancyRatio) as number | undefined,
            payoffRatio: (rawMetrics.payoff_ratio ?? rawMetrics.payoffRatio) as number | undefined,
            avgWin: (rawMetrics.avg_win ?? rawMetrics.avgWin ?? 0) as number,
            avgLoss: (rawMetrics.avg_loss ?? rawMetrics.avgLoss ?? 0) as number,
          };
          const rawTrades = ((br.trades || []) as any[]).map((t: any) => ({
            id: (t.id ?? 0) as number, instrument: (t.instrument ?? "N/A") as string,
            side: (t.side ?? "long") as "long" | "short", size: (t.size ?? 1) as number,
            entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
            exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
            entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
            exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
            stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
            takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
            pnl: (t.pnl ?? 0) as number, pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
            commission: (t.commission ?? 0) as number,
          }));
          const rawEquity = ((br.equity_curve || br.equityCurve || []) as any[]).map((e: any) => ({
            time: (e.time ?? 0) as number, value: (e.value ?? 0) as number,
          }));
          backtestResult = {
            trades: rawTrades, equityCurve: rawEquity, metrics: mappedMetrics,
            strategyName: (br.strategy_name ?? br.strategyName ?? "") as string,
            strategyDescription: (br.strategy_description ?? br.strategyDescription ?? "") as string,
          };
          setTrades(rawTrades);
          setMetrics(mappedMetrics);
          setEquityCurve(rawEquity);
          setStrategyName(backtestResult.strategyName);
          setShowStrategyTester(true);
          setShowBottomPanel(true);
        }

        let pinescriptResult: PineScriptResult | undefined;
        if (response.pinescript) {
          const ps = response.pinescript as any;
          pinescriptResult = {
            name: (ps.name ?? "Custom Strategy") as string,
            description: (ps.description ?? "") as string,
            parameters: (ps.parameters ?? {}) as Record<string, string>,
            code: (ps.code ?? "") as string,
            script_type: (ps.script_type ?? "strategy") as "strategy" | "indicator",
          };
        }

        let parsedMonteCarlo: MonteCarloResult | undefined;
        if (response.monteCarlo) {
          const mc = response.monteCarlo as any;
          parsedMonteCarlo = {
            numSimulations: (mc.num_simulations ?? mc.numSimulations ?? 0) as number,
            numTrades: (mc.num_trades ?? mc.numTrades ?? 0) as number,
            meanReturn: (mc.mean_return ?? mc.meanReturn ?? 0) as number,
            medianReturn: (mc.median_return ?? mc.medianReturn ?? 0) as number,
            stdReturn: (mc.std_return ?? mc.stdReturn ?? 0) as number,
            percentile5: (mc.percentile_5 ?? mc.percentile5 ?? 0) as number,
            percentile25: (mc.percentile_25 ?? mc.percentile25 ?? 0) as number,
            percentile75: (mc.percentile_75 ?? mc.percentile75 ?? 0) as number,
            percentile95: (mc.percentile_95 ?? mc.percentile95 ?? 0) as number,
            meanMaxDrawdown: (mc.mean_max_drawdown ?? mc.meanMaxDrawdown ?? 0) as number,
            medianMaxDrawdown: (mc.median_max_drawdown ?? mc.medianMaxDrawdown ?? 0) as number,
            worstMaxDrawdown: (mc.worst_max_drawdown ?? mc.worstMaxDrawdown ?? 0) as number,
            percentile95Drawdown: (mc.percentile_95_drawdown ?? mc.percentile95Drawdown ?? 0) as number,
            probabilityOfRuin: (mc.probability_of_ruin ?? mc.probabilityOfRuin ?? 0) as number,
            probabilityOfProfit: (mc.probability_of_profit ?? mc.probabilityOfProfit ?? 0) as number,
            equityPercentiles: {
              p5: (mc.equity_percentiles?.p5 ?? mc.equityPercentiles?.p5 ?? []) as number[],
              p25: (mc.equity_percentiles?.p25 ?? mc.equityPercentiles?.p25 ?? []) as number[],
              p50: (mc.equity_percentiles?.p50 ?? mc.equityPercentiles?.p50 ?? []) as number[],
              p75: (mc.equity_percentiles?.p75 ?? mc.equityPercentiles?.p75 ?? []) as number[],
              p95: (mc.equity_percentiles?.p95 ?? mc.equityPercentiles?.p95 ?? []) as number[],
            },
          };
          setMonteCarloResult(parsedMonteCarlo);
        }

        let parsedWalkForward: WalkForwardResult | undefined;
        if (response.walkForward) {
          const wf = response.walkForward as any;
          parsedWalkForward = {
            numWindows: (wf.num_windows ?? wf.numWindows ?? 0) as number,
            isRatio: (wf.is_ratio ?? wf.isRatio ?? 0) as number,
            windows: ((wf.windows ?? []) as any[]).map((w: any) => ({
              windowIndex: (w.window_index ?? w.windowIndex ?? 0) as number,
              isStart: (w.is_start ?? w.isStart ?? "") as string,
              isEnd: (w.is_end ?? w.isEnd ?? "") as string,
              oosStart: (w.oos_start ?? w.oosStart ?? "") as string,
              oosEnd: (w.oos_end ?? w.oosEnd ?? "") as string,
              isBars: (w.is_bars ?? w.isBars ?? 0) as number,
              oosBars: (w.oos_bars ?? w.oosBars ?? 0) as number,
              isMetrics: (w.is_metrics ?? w.isMetrics ?? {}) as Record<string, number>,
              oosMetrics: (w.oos_metrics ?? w.oosMetrics ?? {}) as Record<string, number>,
              bestParams: (w.best_params ?? w.bestParams ?? {}) as Record<string, number>,
            })),
            aggregateOosMetrics: (wf.aggregate_oos_metrics ?? wf.aggregateOosMetrics ?? {}) as Record<string, number>,
            oosTrades: ((wf.oos_trades ?? wf.oosTrades ?? []) as any[]).map((t: any) => ({
              id: (t.id ?? 0) as number, instrument: (t.instrument ?? "N/A") as string,
              side: (t.side ?? "long") as "long" | "short", size: (t.size ?? 1) as number,
              entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
              exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
              entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
              exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
              stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
              takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
              pnl: (t.pnl ?? 0) as number, pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
              commission: (t.commission ?? 0) as number,
            })),
            oosEquityCurve: ((wf.oos_equity_curve ?? wf.oosEquityCurve ?? []) as any[]).map((e: any) => ({
              time: (e.time ?? 0) as number, value: (e.value ?? 0) as number,
            })),
            robustnessRatio: (wf.robustness_ratio ?? wf.robustnessRatio ?? 0) as number,
          };
          setWalkForwardResult(parsedWalkForward);
        }

        let parsedTradeAnalysis: TradeAnalysisResult | undefined;
        if (response.tradeAnalysis) {
          const ta = response.tradeAnalysis as any;
          parsedTradeAnalysis = {
            totalTradesAnalyzed: (ta.total_trades_analyzed ?? ta.totalTradesAnalyzed ?? 0) as number,
            bestEntryHours: ((ta.best_entry_hours ?? ta.bestEntryHours ?? []) as any[]).map((h: any) => ({
              hour: (h.hour ?? 0) as number, avgPnl: (h.avg_pnl ?? h.avgPnl ?? 0) as number,
              tradeCount: (h.trade_count ?? h.tradeCount ?? 0) as number, winRate: (h.win_rate ?? h.winRate ?? 0) as number,
            })),
            bestEntryDays: ((ta.best_entry_days ?? ta.bestEntryDays ?? []) as any[]).map((d: any) => ({
              dayName: (d.day_name ?? d.dayName ?? "") as string, avgPnl: (d.avg_pnl ?? d.avgPnl ?? 0) as number,
              tradeCount: (d.trade_count ?? d.tradeCount ?? 0) as number, winRate: (d.win_rate ?? d.winRate ?? 0) as number,
            })),
            tradeScores: ((ta.trade_scores ?? ta.tradeScores ?? []) as any[]).map((s: any) => ({
              tradeId: (s.trade_id ?? s.tradeId ?? 0) as number, score: (s.score ?? 0) as number,
              factors: (s.factors ?? {}) as Record<string, number>, pnl: (s.pnl ?? 0) as number,
            })),
            avgScoreWinners: (ta.avg_score_winners ?? ta.avgScoreWinners ?? 0) as number,
            avgScoreLosers: (ta.avg_score_losers ?? ta.avgScoreLosers ?? 0) as number,
            avgAtrBeforeWinners: (ta.avg_atr_before_winners ?? ta.avgAtrBeforeWinners ?? 0) as number,
            avgAtrBeforeLosers: (ta.avg_atr_before_losers ?? ta.avgAtrBeforeLosers ?? 0) as number,
            momentumBeforeWinners: (ta.momentum_before_winners ?? ta.momentumBeforeWinners ?? 0) as number,
            momentumBeforeLosers: (ta.momentum_before_losers ?? ta.momentumBeforeLosers ?? 0) as number,
            avgMaeWinners: (ta.avg_mae_winners ?? ta.avgMaeWinners ?? 0) as number,
            avgMaeLosers: (ta.avg_mae_losers ?? ta.avgMaeLosers ?? 0) as number,
            avgMfeWinners: (ta.avg_mfe_winners ?? ta.avgMfeWinners ?? 0) as number,
            avgMfeLosers: (ta.avg_mfe_losers ?? ta.avgMfeLosers ?? 0) as number,
            avgContinuationAfterWin: (ta.avg_continuation_after_win ?? ta.avgContinuationAfterWin ?? 0) as number,
            avgContinuationAfterLoss: (ta.avg_continuation_after_loss ?? ta.avgContinuationAfterLoss ?? 0) as number,
          };
          setTradeAnalysisResult(parsedTradeAnalysis);
        }

        let parsedChartScript: ChartScript | undefined;
        const chartScriptsArr2 = response.chartScripts;
        if (Array.isArray(chartScriptsArr2)) {
          for (const cs of chartScriptsArr2) {
            addChartScript(cs as unknown as ChartScript);
          }
          parsedChartScript = chartScriptsArr2[0] as unknown as ChartScript;
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */

        // Parse indicator commands
        const indicatorRegex = /\[INDICATOR:(\w+)(?::([^\]]+))?\]/g;
        let match;
        while ((match = indicatorRegex.exec(response.message)) !== null) {
          const indType = match[1] as IndicatorType;
          const paramStr = match[2];
          const params: Record<string, number> = {};
          if (paramStr) {
            for (const p of paramStr.split(",")) {
              const [k, v] = p.split("=");
              if (k && v) params[k.trim()] = parseFloat(v.trim());
            }
          }
          handleAddIndicator(indType, Object.keys(params).length > 0 ? params : undefined);
        }

        const cleanMessage = response.message.replace(/\[INDICATOR:[^\]]+\]/g, "").trim();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant", content: cleanMessage || response.message,
          timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
          monteCarloResult: parsedMonteCarlo,
          walkForwardResult: parsedWalkForward,
          tradeAnalysisResult: parsedTradeAnalysis,
          chartScriptResult: parsedChartScript,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        // Fall back to original REST handler
        console.warn("SSE streaming failed, falling back to REST:", err);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setIsLoading(false);
        handleSubmit(message);
        return;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, symbol, interval, addChartScript, handleAddIndicator, handleSubmit, agentStream]
  );

  // ═══════════════════════════════════════════════
  // REPLAY CONTROLS
  // ═══════════════════════════════════════════════
  const handlePlay = useCallback(() => {
    setReplayState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const handlePause = useCallback(() => {
    setReplayState((prev) => ({ ...prev, isPlaying: false }));
    if (replayTimerRef.current) { clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
  }, []);

  const handleStep = useCallback(() => {
    setReplayState((prev) => {
      if (prev.tickMode) {
        const next = Math.min(prev.currentTickIndex + 1, prev.totalTicks);
        return { ...prev, currentTickIndex: next, progress: (next / prev.totalTicks) * 100 };
      }
      const next = Math.min(prev.currentBarIndex + 1, prev.totalBars);
      return { ...prev, currentBarIndex: next, progress: (next / prev.totalBars) * 100 };
    });
  }, []);

  const handleReset = useCallback(() => {
    handlePause();
    setReplayState((prev) => ({ ...prev, currentBarIndex: 1, currentTickIndex: 1, isPlaying: false, progress: 0 }));
  }, [handlePause]);

  const handleSpeedChange = useCallback((speed: number) => {
    setReplayState((prev) => ({ ...prev, speed }));
  }, []);

  const handleSeek = useCallback((barIndex: number) => {
    setReplayState((prev) => {
      if (prev.tickMode) {
        return { ...prev, currentTickIndex: barIndex, progress: (barIndex / prev.totalTicks) * 100 };
      }
      return { ...prev, currentBarIndex: barIndex, progress: (barIndex / prev.totalBars) * 100 };
    });
  }, []);

  // Replay timer
  useEffect(() => {
    if (replayState.isPlaying) {
      let timerInterval: number;
      if (replayState.tickMode) {
        timerInterval = replayState.speed === -1 ? 188 : Math.max(10, 200 / replayState.speed);
        replayTimerRef.current = globalThis.setInterval(() => {
          setReplayState((prev) => {
            if (prev.currentTickIndex >= prev.totalTicks) return { ...prev, isPlaying: false };
            const step = replayState.speed >= 5 ? 10 : replayState.speed >= 3 ? 5 : 1;
            const next = Math.min(prev.currentTickIndex + step, prev.totalTicks);
            return { ...prev, currentTickIndex: next, progress: (next / prev.totalTicks) * 100 };
          });
        }, timerInterval);
      } else {
        if (replayState.speed === -1) {
          const map: Record<string, number> = { "1m": 200, "3m": 500, "5m": 1000, "15m": 2000, "30m": 3000, "1h": 5000, "4h": 8000, "1d": 1000, "1wk": 2000 };
          timerInterval = map[interval] || 200;
        } else {
          timerInterval = 1000 / replayState.speed;
        }
        replayTimerRef.current = globalThis.setInterval(() => {
          setReplayState((prev) => {
            if (prev.currentBarIndex >= prev.totalBars) return { ...prev, isPlaying: false };
            const next = prev.currentBarIndex + 1;
            return { ...prev, currentBarIndex: next, progress: (next / prev.totalBars) * 100 };
          });
        }, timerInterval);
      }
      return () => { if (replayTimerRef.current) { clearInterval(replayTimerRef.current); replayTimerRef.current = null; } };
    }
  }, [replayState.isPlaying, replayState.speed, replayState.tickMode, interval]);

  // Stop replay at end
  useEffect(() => {
    if (replayState.isPlaying) {
      if (replayState.tickMode && replayState.currentTickIndex >= replayState.totalTicks) handlePause();
      else if (!replayState.tickMode && replayState.currentBarIndex >= replayState.totalBars) handlePause();
    }
  }, [replayState.currentBarIndex, replayState.totalBars, replayState.currentTickIndex, replayState.totalTicks, replayState.tickMode, replayState.isPlaying, handlePause]);

  // ═══════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════
  const tickBuiltCandles = useMemo(() => {
    if (!tickMode || ticks.length === 0) return null;
    return buildCandlesFromTicks(ticks, replayState.currentTickIndex, getIntervalSeconds(interval));
  }, [tickMode, ticks, replayState.currentTickIndex, interval, buildCandlesFromTicks, getIntervalSeconds]);

  const displayCandles = tickMode && tickBuiltCandles ? tickBuiltCandles : candles;

  const visibleBars = tickMode
    ? undefined
    : replayState.currentBarIndex < candles.length ? replayState.currentBarIndex : undefined;

  // Spread for the floating trade widget (simulated)
  const spread = useMemo(() => {
    if (symbol.includes("NQ") || symbol.includes("ES")) return 0.50;
    if (symbol.includes("GC")) return 0.10;
    if (symbol.includes("CL")) return 0.01;
    return 0.25;
  }, [symbol]);

  // Replay line position for Chart
  const replayBarIndex = (!replayState.tickMode && replayState.currentBarIndex < replayState.totalBars)
    ? replayState.currentBarIndex
    : undefined;

  // ═══════════════════════════════════════════════
  // TRADE ACTIONS
  // ═══════════════════════════════════════════════
  const handleBuy = useCallback((price: number) => {
    tradingEngine.placeTrade(symbol, "long", 1, price);
  }, [symbol, tradingEngine]);

  const handleSell = useCallback((price: number) => {
    tradingEngine.placeTrade(symbol, "short", 1, price);
  }, [symbol, tradingEngine]);

  const handleClosePosition = useCallback((id: string) => {
    tradingEngine.closePosition(id, currentPrice);
  }, [tradingEngine, currentPrice]);

  const handleCloseAll = useCallback(() => {
    tradingEngine.closeAllPositions(currentPrice);
  }, [tradingEngine, currentPrice]);

  const handleChartClick = useCallback((barIndex: number) => {
    if (selectMode === "bar") {
      handleSeek(barIndex);
      setSelectMode(null);
    }
  }, [selectMode, handleSeek]);

  const handleRandomDate = useCallback(() => {
    if (candles.length === 0) return;
    const randomIndex = Math.floor(Math.random() * candles.length);
    handleSeek(randomIndex);
  }, [candles, handleSeek]);

  // ═══════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape → Cancel pending drawing, revert to crosshair
      if (e.key === "Escape") {
        cancelPending();
        setDrawingTool("crosshair");
        return;
      }
      // Ctrl+S → Symbols search
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowSymbols(true);
      }
      // Ctrl+A is handled by Navbar2's inline trade toggle
      // Ctrl+Shift+X → Kill switch (close all positions)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "X") {
        e.preventDefault();
        handleCloseAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelPending]);

  // ═══════════════════════════════════════════════
  // RENDER (defer until hydrated to avoid flash)
  // ═══════════════════════════════════════════════
  if (!hydrated) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
        <div
          className="flex flex-col items-center justify-center flex-1 gap-4"
          style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}
        >
          Loading…
          <button
            onClick={() => typeof window !== "undefined" && window.location.reload()}
            style={{
              fontSize: 11, color: "var(--text-secondary)", background: "transparent",
              border: "1px solid rgba(236,227,213,0.15)", borderRadius: 6, padding: "6px 12px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)", padding: currentPage === "trade" ? "0 7px 7px" : "0" }}>

      {/* ═══ Top Navigation Bar ═══ */}
      <Navbar1
        activePage={currentPage}
        onPageChange={setCurrentPage}
        onOpenCopilot={() => setShowAlphySidePanel(prev => !prev)}
        onOpenRiskMgmt={() => setShowRiskMgmt(true)}
        onOpenSymbols={() => setShowSymbols(true)}
        onOpenSettings={() => setCurrentPage(currentPage === "settings" ? "dashboard" : "settings")}
        userName={userName}
      />

      {/* ═══ Page Content (with optional Alphy panel on left) ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ═══ Alphy Side Panel (left, pushes content) ═══ */}
        <AnimatePresence>
          {showAlphySidePanel && (
            <CopilotOverlay
              isOpen={showAlphySidePanel}
              onClose={() => setShowAlphySidePanel(false)}
              messages={messages}
              onSendMessage={handleSubmitStreaming}
              isLoading={isLoading}
              symbol={symbol}
              streamingText={agentStream.streamingText}
              toolEvents={agentStream.toolEvents}
              isAgentStreaming={agentStream.isStreaming}
              agentError={agentStream.error}
            />
          )}
        </AnimatePresence>

        {/* ═══ Main Content Area ═══ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {currentPage === "trade" && (
        <>
          <Navbar2
            symbol={symbol}
            onOpenSymbolSearch={() => setShowSymbols(true)}
            interval={interval}
            onIntervalChange={setInterval}
            chartTheme={chartTheme}
            onChartThemeChange={setChartTheme}
            accountState={tradingEngine.accountState}
            currentPrice={currentPrice}
            spread={spread}
            onBuy={handleBuy}
            onSell={handleSell}
            onOpenIndicators={() => setShowIndicatorSearch(true)}
            indicatorCount={indicatorConfigs.length}
            showAccountMetrics={
              showStrategyTester ||
              tradingEngine.accountState.positions.length > 0
            }
          />

          {/* ═══ Main Content: Left Sidebar + Chart + Bottom Panels ═══ */}
          <div className="flex flex-1 min-h-0">
              <>
                <LeftSidebar
                  activeTool={drawingTool}
                  onToolChange={(tool) => {
                    cancelPending();
                    setDrawingTool(tool);
                  }}
                  drawingsVisible={drawingsVisible}
                  onToggleVisibility={() => setDrawingsVisible(prev => !prev)}
                  magnetEnabled={magnetEnabled}
                  onToggleMagnet={() => setMagnetEnabled(prev => !prev)}
                  onDeleteAll={clearAllDrawings}
                  stayInDrawingMode={stayInDrawingMode}
                  onToggleStayInDrawingMode={() => setStayInDrawingMode(prev => !prev)}
                />

                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <div className="flex-1 relative overflow-hidden" style={{ background: "var(--bg)" }}>
                  <Chart
                    candles={displayCandles}
                    trades={tickMode ? [] : trades}
                    visibleBars={visibleBars}
                    symbol={symbol}
                    interval={interval}
                    replayBarIndex={replayBarIndex}
                    activeTool={selectMode === "bar" ? "selectbar" : drawingTool}
                    onChartClick={handleChartClick}
                    onDrawingClick={drawingTool !== "crosshair" ? handleDrawingChartClick : undefined}
                    theme={chartTheme}
                    appearance={chartAppearance}
                    onAppearanceChange={setChartAppearance}
                    positions={appSettings.showPositionsOnChart ? tradingEngine.accountState.positions.filter(p => p.symbol === symbol) : []}
                    currentPrice={currentPrice}
                    onBuyMarket={handleBuy}
                    onSellMarket={handleSell}
                    onBuyLimit={(price) => tradingEngine.placeTrade(symbol, "long", 1, price)}
                    onSellLimit={(price) => tradingEngine.placeTrade(symbol, "short", 1, price)}
                    onClosePosition={handleClosePosition}
                    showBuySellButtons={appSettings.showBuySellButtons}
                    spread={spread}
                    indicators={indicatorResults}
                    indicatorConfigs={indicatorConfigs}
                    onEditIndicator={(c) => setEditIndicatorConfig(c)}
                    magnetEnabled={magnetEnabled}
                    onChartReady={handleChartReady}
                  >
                    {drawingsVisible && (
                      <DrawingOverlay
                        drawings={drawings}
                        chartApi={chartApiRef.current}
                        seriesApi={seriesApiRef.current}
                        pendingPoint={pendingPoint}
                        mousePoint={mousePoint}
                        brushPoints={brushPoints}
                        selectedId={selectedId}
                        activeTool={drawingTool}
                        onRemove={removeDrawing}
                        onSelect={selectDrawing}
                        onUpdate={updateDrawing}
                        onDoubleClick={handleDrawingDoubleClick}
                        theme={chartTheme}
                      />
                    )}

                    {/* Chart script overlays (custom visuals from Alphy) */}
                    <ScriptOverlay
                      results={scriptResults}
                      chartApi={chartApiRef.current}
                      seriesApi={seriesApiRef.current}
                      theme={chartTheme}
                    />

                    {/* Plus button on price scale for quick limit orders */}
                    <PriceScalePlusButton
                      chartContainerRef={chartContainerRef}
                      seriesApi={seriesApiRef.current}
                      theme={chartTheme}
                      onBuyLimit={(price) => tradingEngine.placeTrade(symbol, "long", 1, price)}
                      onSellLimit={(price) => tradingEngine.placeTrade(symbol, "short", 1, price)}
                    />

                    {/* Timezone selector at bottom-right */}
                    <div style={{ position: "absolute", bottom: 6, right: 70, zIndex: 50 }}>
                      <TimezoneSelector
                        timezone={chartTimezone}
                        onTimezoneChange={setChartTimezone}
                        theme={chartTheme}
                      />
                    </div>
                  </Chart>

                  {/* Backtest results now shown in Strategy Tester bottom panel */}

                  {/* Trade widget now lives in Navbar2 */}
                </div>

          {(replayState.currentBarIndex < replayState.totalBars || replayState.isPlaying || replayState.tickMode) && (
            <ReplayControls
              replayState={replayState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStep={handleStep}
              onReset={handleReset}
              onSpeedChange={handleSpeedChange}
              onSeek={handleSeek}
              candles={displayCandles}
            />
          )}

          {/* Bottom Panel — tab strip always visible, content expands */}
          <PositionsPanel
            isExpanded={showBottomPanel}
            onToggle={() => setShowBottomPanel(prev => !prev)}
            expandedHeight={bottomHeight}
            onDragStart={handleDragStart}
            activeBrokerId={activeBrokerId}
            onShowBrokerSelector={() => setShowBrokerSelector(true)}
            accountState={tradingEngine.accountState}
            onClosePosition={handleClosePosition}
            onCloseAll={handleCloseAll}
            replayState={replayState}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={handleStep}
            onReset={handleReset}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
            candles={displayCandles}
            selectMode={selectMode}
            onSelectModeChange={setSelectMode}
            onRandomDate={handleRandomDate}
            backtestMetrics={metrics}
            backtestTrades={trades}
            equityCurve={equityCurve}
            strategyName={strategyName}
            monteCarloResult={monteCarloResult}
            walkForwardResult={walkForwardResult}
            tradeAnalysisResult={tradeAnalysisResult}
            showStrategyTester={showStrategyTester}
            onToggleStrategyTester={() => setShowStrategyTester(prev => !prev)}
            onLoadStrategy={handleLoadStrategy}
            onSetBalance={tradingEngine.setBalance}
          />

          <StatusBar
            symbol={symbol}
            interval={tickMode ? `${interval} (Tick)` : interval}
            candleCount={tickMode ? ticks.length : candles.length}
            brokerName={BROKER_LIST.find(b => b.id === activeBrokerId)?.name ?? "Paper Trading"}
            brokerConnected={activeBrokerId !== "paper"}
            onOpenBrokerPanel={() => setShowBrokerSelector(true)}
          />
                </div>
              </>
          </div>
        </>
      )}

      {currentPage === "dashboard" && (
        <DashboardPage
          accountState={tradingEngine.accountState}
          onNavigateToChart={(ticker) => { setSymbol(ticker); setCurrentPage("trade"); }}
        />
      )}

      {currentPage === "portfolio" && (
        <PortfolioPage
          accountState={tradingEngine.accountState}
          currentPrice={currentPrice}
          onNavigateToChart={(ticker) => { setSymbol(ticker); setCurrentPage("trade"); }}
        />
      )}

      {currentPage === "news" && (
        <NewsPage
          onClose={() => setCurrentPage("dashboard")}
          onNavigateToChart={(ticker) => {
            setSymbol(ticker);
            setCurrentPage("trade");
          }}
        />
      )}

      {currentPage === "alpha" && (
        <AlphaPlayground
          onNavigateToChart={(ticker) => {
            setSymbol(ticker);
            setCurrentPage("trade");
          }}
        />
      )}

      {currentPage === "settings" && (
        <SettingsPage
          settings={appSettings}
          onUpdateSettings={setAppSettings}
          riskSettings={riskSettings}
          onUpdateRiskSettings={setRiskSettings}
          onBack={() => setCurrentPage("dashboard")}
        />
      )}
        </div>
      </div>

      {/* ═══ OVERLAYS ═══ */}
      <AnimatePresence>
        {showSymbols && (
          <SymbolsSearch
            isOpen={showSymbols}
            onClose={() => setShowSymbols(false)}
            onSelectSymbol={(s) => { setSymbol(s); setShowSymbols(false); }}
            currentSymbol={symbol}
            accountState={tradingEngine.accountState}
          />
        )}
      </AnimatePresence>

      <IndicatorSearchModal
        isOpen={showIndicatorSearch}
        onClose={() => setShowIndicatorSearch(false)}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onToggleIndicator={handleToggleIndicator}
        onEditIndicator={(c) => { setShowIndicatorSearch(false); setEditIndicatorConfig(c); }}
        activeIndicators={indicatorConfigs}
      />

      <IndicatorEditModal
        config={editIndicatorConfig}
        isOpen={!!editIndicatorConfig}
        onClose={() => setEditIndicatorConfig(null)}
        onSave={handleUpdateIndicator}
      />

      <AnimatePresence>
        {showRiskMgmt && (
          <RiskManagement
            isOpen={showRiskMgmt}
            onClose={() => setShowRiskMgmt(false)}
            settings={riskSettings}
            onUpdateSettings={setRiskSettings}
          />
        )}
      </AnimatePresence>

      {/* Drawing edit modal */}
      {editModalDrawing && (
        <DrawingEditModal
          drawing={editModalDrawing.drawing}
          position={editModalDrawing.position}
          theme={chartTheme}
          onUpdate={(id, updates) => {
            updateDrawing(id, updates as Partial<Drawing>);
            setEditModalDrawing((prev) =>
              prev ? { ...prev, drawing: { ...prev.drawing, ...updates } as Drawing } : null
            );
          }}
          onClose={handleEditModalClose}
          onDelete={(id) => {
            removeDrawing(id);
            setEditModalDrawing(null);
          }}
        />
      )}

      {/* ═══ Broker Selection Modal ═══ */}
      <AnimatePresence>
        {showBrokerSelector && (
          <BrokerSelectionModal
            activeBrokerId={activeBrokerId}
            onSelectBroker={(id) => { setActiveBrokerId(id); setShowBrokerSelector(false); }}
            onClose={() => setShowBrokerSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* ═══ Alphy Welcome Toast ═══ */}
      <AnimatePresence>
        {welcomeToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => { setWelcomeToast(null); setShowAlphySidePanel(true); }}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 20000,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 18px",
              maxWidth: 340,
              borderRadius: 16,
              background: "rgba(33,30,26,0.95)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "0.667px solid rgba(236,227,213,0.12)",
              boxShadow: "0 8px 32px rgba(15,12,8,0.6), 0 0 0 1px rgba(236,227,213,0.04)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {/* Alphy avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, var(--accent), var(--accent-bright))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(196,123,58,0.3)",
            }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>a</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Alphy</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>now</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                {welcomeToast.preview}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
