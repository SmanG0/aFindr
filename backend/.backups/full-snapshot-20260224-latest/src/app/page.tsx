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
// LoadingScreen available for future use
// import LoadingScreen from "@/components/LoadingScreen";
import DashboardPage from "@/components/DashboardPage/DashboardPage";
import PortfolioPage from "@/components/PortfolioPage/PortfolioPage";
import AlphaPlayground from "@/components/AlphaPlayground/AlphaPlayground";
import JournalPage from "@/components/DashboardPage/JournalPage";
import LibraryPage from "@/components/DashboardPage/LibraryPage";
import FooterPage, { FOOTER_PAGE_IDS, type FooterPageId } from "@/components/FooterPages/FooterPages";
// AlphyCompanion available for future use
// import AlphyCompanion from "@/components/AlphyCompanion/AlphyCompanion";
import { useTradingEngine } from "@/hooks/useTradingEngine";
import { useCurrentUser } from "@/hooks/useConvexUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { sendChatMessage, fetchOHLCV, fetchTicks, takeSnapshot } from "@/lib/api";
// NOTE: useAgentStream added as part of Agent SDK + SSE migration.
//       Provides real-time streaming chat via POST /api/chat/stream.
//       Original REST sendChatMessage is preserved as fallback.
import { useAgentStream } from "@/hooks/useAgentStream";
// DoneEvent type available for future use
// import type { DoneEvent } from "@/hooks/useAgentStream";
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
  INDICATOR_DEFS,
  computeIndicator,
  createIndicatorConfig,
} from "@/lib/indicators";
import { applyTheme, isLightTheme } from "@/lib/theme";
import IndicatorSearchModal from "@/components/IndicatorSearch/IndicatorSearchModal";
import IndicatorEditModal from "@/components/IndicatorSearch/IndicatorEditModal";
import ScriptOverlay from "@/components/Chart/ScriptOverlay";
import { useChartScripts } from "@/hooks/useChartScripts";
import type { ChartScript } from "@/lib/chart-scripts";
import { useAgentControl } from "@/hooks/useAgentControl";
import AgentControlOverlay from "@/components/AgentControl/AgentControlOverlay";
import JournalPanel from "@/components/JournalPanel/JournalPanel";

// ─── Parse indicator tags from Alphy responses ───
// Extracts [INDICATOR:...] tags, detects [CLEAR_INDICATORS] and [CLEAR_SCRIPTS],
// returns clean message with all control tags stripped.
function parseIndicatorTags(message: string): {
  indicators: IndicatorConfig[];
  clearIndicators: boolean;
  clearScripts: boolean;
  scriptUpdates: { name: string; updates: Record<string, string> }[];
  scriptDeletes: string[];
  cleanMessage: string;
} {
  const indicators: IndicatorConfig[] = [];
  const clearIndicators = /\[CLEAR_INDICATORS\]/i.test(message);
  const clearScripts = /\[CLEAR_SCRIPTS\]/i.test(message);

  const indicatorRegex = /\[INDICATOR:(\w+)(?::([^\]]+))?\]/g;
  let match;
  while ((match = indicatorRegex.exec(message)) !== null) {
    const indType = match[1] as IndicatorType;
    // Validate it's a known indicator type
    if (!INDICATOR_DEFS.find((d) => d.type === indType)) continue;

    const paramStr = match[2];
    const params: Record<string, number> = {};
    let color: string | undefined;
    if (paramStr) {
      for (const p of paramStr.split(",")) {
        const [k, v] = p.split("=");
        if (!k || !v) continue;
        const key = k.trim();
        const val = v.trim();
        if (key === "color") {
          color = val;
        } else {
          const num = parseFloat(val);
          if (!isNaN(num)) params[key] = num;
        }
      }
    }

    const config = createIndicatorConfig(indType, {
      ...(Object.keys(params).length > 0 ? { params } : {}),
      ...(color ? { color } : {}),
      source: "alphy",
    });
    indicators.push(config);
  }

  // Parse script update tags: [SCRIPT_UPDATE:name:key=value,key=value]
  // Name may contain colons, so we match the LAST : that precedes key=value pairs
  const scriptUpdates: { name: string; updates: Record<string, string> }[] = [];
  const updateRegex = /\[SCRIPT_UPDATE:(.+?):(\w+=[^\]]+)\]/g;
  while ((match = updateRegex.exec(message)) !== null) {
    const name = match[1];
    const params: Record<string, string> = {};
    for (const p of match[2].split(",")) {
      const [k, v] = p.split("=");
      if (k && v) params[k.trim()] = v.trim();
    }
    scriptUpdates.push({ name, updates: params });
  }

  // Parse script delete tags: [SCRIPT_DELETE:name]
  const scriptDeletes: string[] = [];
  const deleteRegex = /\[SCRIPT_DELETE:([^\]]+)\]/g;
  while ((match = deleteRegex.exec(message)) !== null) {
    scriptDeletes.push(match[1]);
  }

  // Strip all control tags from message
  const cleanMessage = message
    .replace(/\[INDICATOR:[^\]]+\]/g, "")
    .replace(/\[CLEAR_INDICATORS\]/gi, "")
    .replace(/\[CLEAR_SCRIPTS\]/gi, "")
    .replace(/\[SCRIPT_UPDATE:[^\]]+\]/g, "")
    .replace(/\[SCRIPT_DELETE:[^\]]+\]/g, "")
    .trim();

  return { indicators, clearIndicators, clearScripts, scriptUpdates, scriptDeletes, cleanMessage };
}

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
  // CONVEX USER
  // ═══════════════════════════════════════════════
  const { userId, isAuthenticated } = useCurrentUser();

  // ═══════════════════════════════════════════════
  // PAGE NAVIGATION (synced with browser history)
  // ═══════════════════════════════════════════════
  const VALID_PAGES = new Set<AppPage>(["trade", "dashboard", "portfolio", "news", "alpha", "settings", "journal", "library", "help-center", "contact", "report-bug", "changelog", "roadmap", "api-docs", "terms", "privacy", "risk-disclosure"]);

  const parsePageFromHash = useCallback((): AppPage | null => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.replace("#", "");
    return VALID_PAGES.has(hash as AppPage) ? (hash as AppPage) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [hydrated, setHydrated] = useState(false);
  const [userName, setUserName] = useState("");
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const isPopstateRef = useRef(false);

  /** Navigate to a page — updates state, localStorage, and browser history.
   *
   *  History stack is always exactly:
   *    [sentinel] → [dashboard] → [currentPage]  (3 max)
   *
   *  - Back from any non-dashboard page → dashboard
   *  - Back from dashboard → hits sentinel → logout prompt
   *  - Page-to-page (non-dashboard) replaces the top entry so stack never grows */
  const navigateTo = useCallback((page: AppPage) => {
    // Dismiss logout prompt on any navigation
    setShowLogoutPrompt(false);
    setCurrentPage((prev) => {
      if (prev === page) return prev;
      if (!isPopstateRef.current) {
        if (page === "dashboard") {
          // Going home: replace current entry with dashboard
          window.history.replaceState({ page: "dashboard" }, "", "#dashboard");
        } else if (prev === "dashboard") {
          // Push on top of dashboard: [sentinel, dashboard, page]
          window.history.pushState({ page }, "", `#${page}`);
        } else {
          // Replace top: [sentinel, dashboard, page]
          window.history.replaceState({ page }, "", `#${page}`);
        }
      }
      return page;
    });
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("afindr_onboarding");
    localStorage.removeItem("afindr_onboarding_welcomed");
    localStorage.removeItem("afindr_current_page");
    window.location.replace("/landing");
  }, []);

  useEffect(() => {
    // Redirect to landing if onboarding not completed
    try {
      const onboarding = localStorage.getItem("afindr_onboarding");
      if (!onboarding || !JSON.parse(onboarding).completed) {
        // Dev bypass: auto-complete onboarding in development
        if (process.env.NODE_ENV === "development") {
          localStorage.setItem("afindr_onboarding", JSON.stringify({ completed: true, name: "Dev" }));
          setUserName("Dev");
        } else {
          window.location.replace("/landing");
          return;
        }
      } else {
        const parsed = JSON.parse(onboarding);
        if (parsed.name) setUserName(parsed.name);
      }
    } catch {
      if (process.env.NODE_ENV === "development") {
        localStorage.setItem("afindr_onboarding", JSON.stringify({ completed: true, name: "Dev" }));
        setUserName("Dev");
      } else {
        window.location.replace("/landing");
        return;
      }
    }

    // Priority: URL hash > localStorage > default "dashboard"
    const hashPage = parsePageFromHash();
    const saved = localStorage.getItem("afindr_current_page");
    const initial = hashPage
      ?? (VALID_PAGES.has(saved as AppPage) ? (saved as AppPage) : null)
      ?? "dashboard";
    setCurrentPage(initial);

    // Seed history stack:
    //   [guard] → [dashboard] → [page?]
    //
    // "guard" is a dashboard-looking entry that triggers the logout prompt.
    // Back from any page → dashboard. Back from dashboard → guard → popup.
    window.history.replaceState({ page: "dashboard", guard: true }, "", "#dashboard");
    window.history.pushState({ page: "dashboard" }, "", "#dashboard");
    if (initial !== "dashboard") {
      window.history.pushState({ page: initial }, "", `#${initial}`);
    }
    setHydrated(true);

    // Listen for browser back / forward
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as { page?: string; guard?: boolean } | null;

      if (state?.guard) {
        // User backed from dashboard → hit the guard entry.
        // Stay on dashboard, show logout prompt.
        // Push the dashboard entry back on top so the stack is restored.
        window.history.pushState({ page: "dashboard" }, "", "#dashboard");
        setShowLogoutPrompt(true);
        return;
      }

      // Navigating to a real page — dismiss any open logout prompt
      setShowLogoutPrompt(false);
      const page = state?.page as AppPage | undefined;
      if (page && VALID_PAGES.has(page)) {
        isPopstateRef.current = true;
        setCurrentPage(page);
        isPopstateRef.current = false;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("afindr_current_page", currentPage);
    }
  }, [currentPage, hydrated]);

  // ═══════════════════════════════════════════════
  // DATA STATE
  // ═══════════════════════════════════════════════
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbol, setSymbol] = useState(() => {
    if (typeof window !== "undefined") {
      // Priority: persisted symbol > profile default > NQ=F
      const saved = localStorage.getItem("afindr_symbol");
      if (saved) return saved;
      try {
        const profile = JSON.parse(localStorage.getItem("afindr_onboarding") || "{}");
        if (profile.instruments?.[0]) return profile.instruments[0];
      } catch { /* ignore */ }
      return "NQ=F";
    }
    return "NQ=F";
  });
  const [interval, setInterval] = useState(() => {
    if (typeof window !== "undefined") {
      // Priority: persisted interval > style-based default > 1d
      const saved = localStorage.getItem("afindr_interval");
      if (saved) return saved;
      try {
        const profile = JSON.parse(localStorage.getItem("afindr_onboarding") || "{}");
        const styleIntervals: Record<string, string> = {
          scalper: "1m",
          "day trader": "5m",
          "swing trader": "4h",
          "position trader": "1d",
        };
        const styleDefault = styleIntervals[profile.tradingStyle?.toLowerCase()];
        if (styleDefault) return styleDefault;
      } catch { /* ignore */ }
      return "1d";
    }
    return "1d";
  });

  // Persist symbol and interval across reloads
  useEffect(() => {
    localStorage.setItem("afindr_symbol", symbol);
  }, [symbol]);

  useEffect(() => {
    localStorage.setItem("afindr_interval", interval);
  }, [interval]);

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
  const [activeConversationId, setActiveConversationId] = useState<import("../../convex/_generated/dataModel").Id<"chatConversations"> | null>(null);
  // NOTE: Agent SDK + SSE streaming hook. Provides real-time token streaming.
  //       Falls back to REST sendChatMessage if streaming fails.
  const agentStream = useAgentStream();

  // Convex chat mutations
  const createConversation = useMutation(api.chat.createConversation);
  const addChatMessage = useMutation(api.chat.addMessage);
  const deleteConversationMut = useMutation(api.chat.deleteConversation);
  const trackTokenUsage = useMutation(api.tokenUsage.track);
  const convexConversations = useQuery(api.chat.listConversations, isAuthenticated ? {} : "skip");
  const convexMessages = useQuery(
    api.chat.listMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip",
  );

  // Convex alert queries + mutations (for agent manage_alerts tool)
  const convexAlerts = useQuery(api.alerts.list, isAuthenticated ? {} : "skip");
  const alertsCreate = useMutation(api.alerts.create);
  const alertsUpdate = useMutation(api.alerts.update);
  const alertsRemove = useMutation(api.alerts.remove);

  // Restore most recent conversation from Convex on mount
  const chatRestoredRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || chatRestoredRef.current || convexConversations === undefined) return;
    chatRestoredRef.current = true;
    if (convexConversations.length > 0) {
      setActiveConversationId(convexConversations[0]._id);
    }
  }, [isAuthenticated, convexConversations]);

  // When activeConversationId changes and messages load, populate local state.
  // Track which conversation we last restored to avoid re-populating on every convexMessages update.
  const restoredConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeConversationId || convexMessages === undefined) return;
    // Already restored this conversation
    if (restoredConvIdRef.current === activeConversationId) return;
    restoredConvIdRef.current = activeConversationId;
    if (convexMessages.length > 0) {
      const restored: ChatMessage[] = convexMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m._id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.createdAt,
        }));
      setMessages(restored);
    }
  }, [activeConversationId, convexMessages]);

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
      const tradingStyle = onboarding.tradingStyle || "";
      const analysisApproach: string[] = onboarding.analysisApproach || [];
      const tradingGoals: string[] = onboarding.tradingGoals || [];
      const defaultInstrument = onboarding.instruments?.[0] || "NQ=F";

      // Build style-aware interval hint
      const styleIntervals: Record<string, string> = {
        scalper: "1-minute",
        "day trader": "5-minute",
        "swing trader": "4-hour",
        "position trader": "daily",
      };
      const intervalHint = styleIntervals[tradingStyle] || "daily";

      // Experience-specific tips
      const tips: Record<string, string> = {
        beginner: "I'd recommend starting with the Dashboard to get a feel for the markets, then try asking me to explain any chart pattern or indicator you're curious about.",
        intermediate: "Try asking me to backtest a strategy you've been using -- I can run Monte Carlo simulations and walk-forward analysis to validate your edge.",
        advanced: "You've got full access to backtesting, walk-forward optimization, Monte Carlo sims, and custom PineScript generation. Ask me anything.",
      };

      // Build suggested prompts based on profile
      const suggestions: string[] = [];
      if (analysisApproach.includes("technical")) {
        suggestions.push(`'Show me VWAP with session levels on ${defaultInstrument}'`);
      }
      if (analysisApproach.includes("quantitative") || experience === "advanced") {
        suggestions.push(`'Backtest an EMA crossover on ${defaultInstrument}'`);
      }
      if (analysisApproach.includes("price action")) {
        suggestions.push(`'Find support and resistance levels on ${defaultInstrument}'`);
      }
      if (analysisApproach.includes("fundamental")) {
        suggestions.push(`'Show me upcoming earnings and economic events'`);
      }
      if (suggestions.length === 0) {
        suggestions.push(`'What's happening with ${defaultInstrument} today?'`);
      }

      // Build personalized content line
      const styleLine = tradingStyle
        ? `Your ${defaultInstrument} ${intervalHint} chart is loaded. I see you're focused on ${tradingStyle.includes("trader") ? tradingStyle.replace("trader", "").trim() : tradingStyle} trading${markets ? ` in ${markets}` : ""}${analysisApproach.length > 0 ? ` with ${analysisApproach.join(" and ")}` : ""}.`
        : `I see you're interested in ${markets || "the markets"} -- great choices.`;

      const goalsLine = tradingGoals.length > 0
        ? `\n\nI'll tailor my suggestions to help you with ${tradingGoals.map((g: string) => {
          const goalLabels: Record<string, string> = { income: "consistent income", growth: "capital growth", learning: "learning", automated: "systematic trading" };
          return goalLabels[g] || g;
        }).join(" and ")}.`
        : "";

      const welcome: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Welcome to aFindr, ${name}. I'm Alphy, your AI trading copilot.\n\n${styleLine} ${tips[experience] || tips.beginner}${goalsLine}\n\nTry: ${suggestions.slice(0, 2).join(" or ")}`,
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

  // One-time full sync to Convex on app load is handled inside useTradingEngine

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
  const [showJournalPanel, setShowJournalPanel] = useState(false);
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
  const convexSettings = useQuery(api.settings.getSettings, isAuthenticated ? {} : "skip");
  const memoryProfile = useQuery(api.memory.getProfile, isAuthenticated ? {} : "skip");
  const upsertSettings = useMutation(api.settings.upsertSettings);

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

  // Convex settings reconciliation
  const settingsReconciledRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || convexSettings === undefined || settingsReconciledRef.current) return;
    settingsReconciledRef.current = true;
    if (convexSettings) {
      // Convex has data → use it, update localStorage
      const { _id: _cid, _creationTime: _ct, userId: _u, updatedAt: _t, ...rest } = convexSettings;
      void _cid; void _ct; void _u; void _t;
      const merged = { ...DEFAULT_APP_SETTINGS, ...rest } as AppSettings;
      setAppSettingsState(merged);
      try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
    } else {
      // Convex empty → seed from current settings
      upsertSettings({ settings: appSettings });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, convexSettings]);

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
      // Dual-write to Convex
      if (isAuthenticated) {
        upsertSettings({ settings: nextVal });
      }
      return nextVal;
    });
  }, [isAuthenticated, upsertSettings]);

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

  // Replace all Alphy-managed indicators with a new set, preserving manual (UI-added) ones
  const handleSetAlphyIndicators = useCallback((configs: IndicatorConfig[]) => {
    setIndicatorConfigs((prev) => {
      const manual = prev.filter((c) => c.source !== "alphy");
      return [...manual, ...configs];
    });
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
    scripts: chartScripts,
    scriptResults,
    addScript: addChartScript,
    removeScript: _removeChartScript,
    clearAllScripts: clearAllChartScripts,
    updateScriptByName,
    deleteScriptByName,
  } = useChartScripts(candles, symbol);
  void _removeChartScript;

  // ═══════════════════════════════════════════════
  // AGENT CONTROL MODE
  // ═══════════════════════════════════════════════
  const agentControl = useAgentControl({
    setInterval: (v) => setInterval(v),
    setSymbol: (v) => setSymbol(v),
    setCurrentPage: (v) => navigateTo(v as AppPage),
    togglePanel: (panel) => {
      switch (panel) {
        case "strategyTester": setShowStrategyTester((p) => !p); break;
        case "indicatorSearch": setShowIndicatorSearch((p) => !p); break;
        case "riskMgmt": setShowRiskMgmt((p) => !p); break;
        case "bottomPanel": setShowBottomPanel((p) => !p); break;
        case "alphySidePanel": setShowAlphySidePanel((p) => !p); break;
      }
    },
    setDrawingTool: (v) => setDrawingTool(v as DrawingTool),
  });

  // Dispatch agent UI actions to control overlay
  useEffect(() => {
    if (agentStream.uiActions.length === 0) return;
    const latest = agentStream.uiActions[agentStream.uiActions.length - 1];
    if (latest?.actions) {
      agentControl.enqueueActions(latest.actions as import("@/hooks/useAgentControl").UIAction[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStream.uiActions.length]);

  // Dispatch agent position actions to trading engine
  useEffect(() => {
    if (agentStream.positionActions.length === 0) return;
    const latest = agentStream.positionActions[agentStream.positionActions.length - 1];
    if (!latest?.actions) return;

    for (const pa of latest.actions) {
      switch (pa.action) {
        case "add":
          if (pa.symbol && pa.size) {
            const price = pa.entry_price ?? currentPrice;
            tradingEngine.placeTrade(
              pa.symbol,
              (pa.side as "long" | "short") || "long",
              pa.size,
              price,
              pa.stop_loss ?? undefined,
              pa.take_profit ?? undefined,
            );
          }
          break;
        case "edit":
          if (pa.symbol && pa.updates) {
            tradingEngine.editPosition(pa.symbol, {
              size: pa.updates.size as number | undefined,
              stopLoss: pa.updates.stop_loss as number | undefined,
              takeProfit: pa.updates.take_profit as number | undefined,
            });
          }
          break;
        case "remove":
          if (pa.symbol) {
            tradingEngine.removeBySymbol(pa.symbol, currentPrice);
          }
          break;
        case "remove_all":
          tradingEngine.closeAllPositions(currentPrice);
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStream.positionActions.length]);

  // Dispatch agent alert actions to Convex mutations
  useEffect(() => {
    if (agentStream.alertActions.length === 0 || !isAuthenticated) return;
    const latest = agentStream.alertActions[agentStream.alertActions.length - 1];
    if (!latest?.actions) return;

    for (const aa of latest.actions) {
      switch (aa.action) {
        case "create":
          if (aa.type && aa.symbol) {
            alertsCreate({
              type: aa.type,
              symbol: aa.symbol,
              condition: aa.condition,
              targetPrice: aa.targetPrice,
              keywords: aa.keywords,
            });
          }
          break;
        case "toggle":
          if (aa.alertId && aa.active !== undefined) {
            alertsUpdate({
              alertId: aa.alertId as import("../../convex/_generated/dataModel").Id<"alerts">,
              active: aa.active,
            });
          }
          break;
        case "delete":
          if (aa.alertId) {
            alertsRemove({
              alertId: aa.alertId as import("../../convex/_generated/dataModel").Id<"alerts">,
            });
          }
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStream.alertActions.length]);

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
      case "1m": return "5d";
      case "5m": return "5d";
      case "15m": return "1mo";
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
  // CHAT PERSISTENCE HELPER
  // ═══════════════════════════════════════════════
  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  const persistChatMessage = useCallback(async (role: "user" | "assistant", content: string) => {
    if (!isAuthenticated) return;
    let convId = activeConvIdRef.current;
    if (!convId) {
      // Create a new conversation on first message
      const title = content.slice(0, 60) + (content.length > 60 ? "..." : "");
      convId = await createConversation({ title });
      setActiveConversationId(convId);
      activeConvIdRef.current = convId;
    }
    addChatMessage({ conversationId: convId, role, content });
  }, [isAuthenticated, createConversation, addChatMessage]);

  // ═══════════════════════════════════════════════
  // CHAT HISTORY / NEW CHAT
  // ═══════════════════════════════════════════════
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    activeConvIdRef.current = null;
    restoredConvIdRef.current = null;
    agentStream.abort();
  }, [agentStream]);

  const handleSelectConversation = useCallback((id: typeof activeConversationId) => {
    if (!id || id === activeConversationId) return;
    setMessages([]);
    setActiveConversationId(id);
    activeConvIdRef.current = id;
    restoredConvIdRef.current = null; // allow restore for the new conversation
  }, [activeConversationId]);

  const handleDeleteConversation = useCallback(async (id: typeof activeConversationId) => {
    if (!id) return;
    if (id === activeConversationId) handleNewChat();
    await deleteConversationMut({ conversationId: id });
  }, [activeConversationId, handleNewChat, deleteConversationMut]);

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
      // Persist user message to Convex
      persistChatMessage("user", message);
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
        // Stamp each script with the current symbol so it only shows on this chart
        let parsedChartScript: ChartScript | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resp = response as Record<string, any>;
        const chartScriptsArr = resp.chart_scripts ?? resp.chartScripts;
        if (Array.isArray(chartScriptsArr)) {
          for (const cs of chartScriptsArr) {
            const stamped = { ...(cs as ChartScript), symbol: (cs as ChartScript).symbol ?? symbol };
            addChartScript(stamped);
          }
          parsedChartScript = chartScriptsArr[0] as ChartScript;
        } else if (resp.chart_script ?? resp.chartScript) {
          parsedChartScript = (resp.chart_script ?? resp.chartScript) as ChartScript;
          addChartScript({ ...parsedChartScript, symbol: parsedChartScript.symbol ?? symbol });
        }

        // Parse indicator commands + control tags from AI response
        const parsed = parseIndicatorTags(response.message);
        if (parsed.clearIndicators) {
          handleSetAlphyIndicators([]);
        }
        if (parsed.indicators.length > 0) {
          handleSetAlphyIndicators(parsed.indicators);
        }
        if (parsed.clearScripts) {
          clearAllChartScripts();
        }
        for (const su of parsed.scriptUpdates) {
          updateScriptByName(su.name, su.updates);
        }
        for (const sd of parsed.scriptDeletes) {
          deleteScriptByName(sd);
        }

        const assistantContent = parsed.cleanMessage || response.message;
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant", content: assistantContent,
          timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
          monteCarloResult: parsedMonteCarlo,
          walkForwardResult: parsedWalkForward,
          tradeAnalysisResult: parsedTradeAnalysis,
          chartScriptResult: parsedChartScript,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        persistChatMessage("assistant", assistantContent);
      } catch (err) {
        const errorContent = `Error: ${err instanceof Error ? err.message : "Something went wrong"}`;
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant",
          content: errorContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, symbol, interval, addChartScript, handleSetAlphyIndicators, clearAllChartScripts, updateScriptByName, deleteScriptByName, persistChatMessage]
  );

  // ═══════════════════════════════════════════════
  // STREAMING CHAT (Agent SDK + SSE)
  // NOTE: Added as part of Agent SDK migration. Tries SSE streaming first,
  //       falls back to REST handleSubmit if streaming fails.
  //       Original handleSubmit above is preserved unchanged.
  // ═══════════════════════════════════════════════
  const handleSubmitStreaming = useCallback(
    async (message: string) => {
      // Capture history BEFORE adding the new user message to avoid duplication
      // (backend appends `message` as the new turn — including it here would double it)
      const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "user", content: message, timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      // Persist user message to Convex
      persistChatMessage("user", message);

      try {
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

        // Load user profile for agent personalization (onboarding + AI memory)
        let userProfile: Record<string, unknown> | undefined;
        try {
          const profile = JSON.parse(localStorage.getItem("afindr_onboarding") || "{}");
          if (profile.completed) {
            userProfile = {
              name: profile.name || "",
              experience: profile.experience || "",
              tradingStyle: profile.tradingStyle || "",
              analysisApproach: profile.analysisApproach || [],
              tradingGoals: profile.tradingGoals || [],
              markets: profile.markets || [],
            };
          }
        } catch { /* ignore */ }
        // Merge in AI memory profile from Convex (if available)
        if (memoryProfile && userProfile) {
          userProfile.profileSummary = memoryProfile.profileSummary;
          userProfile.favoriteSymbols = memoryProfile.favoriteSymbols;
          userProfile.strengths = memoryProfile.strengths;
          userProfile.weaknesses = memoryProfile.weaknesses;
        } else if (memoryProfile) {
          userProfile = {
            profileSummary: memoryProfile.profileSummary,
            favoriteSymbols: memoryProfile.favoriteSymbols,
            strengths: memoryProfile.strengths,
            weaknesses: memoryProfile.weaknesses,
          };
        }

        const doneEvent = await agentStream.streamMessage({
          message,
          symbol,
          period: "1y",
          interval,
          conversation_history: conversationHistory,
          current_page: currentPage,
          news_headlines: newsHeadlines,
          active_scripts: chartScripts
            .filter(s => s.visible && (!s.symbol || s.symbol === symbol))
            .map(s => {
              const genTypes = s.generators.map(g => g.type).join(",");
              const elCount = s.elements.length;
              const parts = [s.name];
              if (elCount > 0) parts.push(`${elCount} elements`);
              if (genTypes) parts.push(`generators: ${genTypes}`);
              return parts.join(" | ");
            }),
          user_profile: userProfile,
          active_alerts: convexAlerts?.map(a => ({
            id: a._id,
            type: a.type,
            symbol: a.symbol,
            condition: a.condition,
            targetPrice: a.targetPrice,
            keywords: a.keywords,
            active: a.active,
          })),
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
          toolData: doneEvent.tool_data as any[] | null,
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
            const stamped = { ...(cs as unknown as ChartScript), symbol: (cs as unknown as ChartScript).symbol ?? symbol };
            addChartScript(stamped);
          }
          parsedChartScript = chartScriptsArr2[0] as unknown as ChartScript;
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */

        // Parse indicator commands + control tags from AI response
        const parsed = parseIndicatorTags(response.message);
        if (process.env.NODE_ENV === "development") {
          console.log("[Alphy] Done message:", response.message?.slice(0, 200));
          console.log("[Alphy] Parsed indicators:", parsed.indicators.map(i => i.type));
          console.log("[Alphy] Script updates:", parsed.scriptUpdates.length, "deletes:", parsed.scriptDeletes.length);
        }
        if (parsed.clearIndicators) {
          handleSetAlphyIndicators([]);
        }
        if (parsed.indicators.length > 0) {
          handleSetAlphyIndicators(parsed.indicators);
        }
        if (parsed.clearScripts) {
          clearAllChartScripts();
        }
        for (const su of parsed.scriptUpdates) {
          updateScriptByName(su.name, su.updates);
        }
        for (const sd of parsed.scriptDeletes) {
          deleteScriptByName(sd);
        }

        const streamAssistantContent = parsed.cleanMessage || response.message;
        // Parse tool data for rich artifact rendering in sidebar
        const parsedToolData = Array.isArray(response.toolData)
          ? (response.toolData as { tool: string; input: Record<string, unknown>; data: Record<string, unknown> }[])
          : undefined;
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant", content: streamAssistantContent,
          timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
          monteCarloResult: parsedMonteCarlo,
          walkForwardResult: parsedWalkForward,
          tradeAnalysisResult: parsedTradeAnalysis,
          chartScriptResult: parsedChartScript,
          toolData: parsedToolData,
          tokenUsage: doneEvent.token_usage ? {
            totalTokens: doneEvent.token_usage.total_input_tokens + doneEvent.token_usage.total_output_tokens,
            inputTokens: doneEvent.token_usage.total_input_tokens,
            outputTokens: doneEvent.token_usage.total_output_tokens,
            estimatedCost: doneEvent.token_usage.estimated_cost_usd,
          } : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        persistChatMessage("assistant", streamAssistantContent);

        // Persist token usage to Convex
        if (isAuthenticated && doneEvent.token_usage) {
          trackTokenUsage({
            conversationId: activeConvIdRef.current ?? undefined,
            inputTokens: doneEvent.token_usage.total_input_tokens,
            outputTokens: doneEvent.token_usage.total_output_tokens,
            estimatedCost: doneEvent.token_usage.estimated_cost_usd,
            byModelJson: doneEvent.token_usage.by_model
              ? JSON.stringify(doneEvent.token_usage.by_model)
              : undefined,
          }).catch((err) => {
            console.warn("Failed to persist token usage:", err);
          });
        }
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
    [messages, symbol, interval, addChartScript, handleSetAlphyIndicators, clearAllChartScripts, updateScriptByName, deleteScriptByName, handleSubmit, agentStream, persistChatMessage, memoryProfile, isAuthenticated, trackTokenUsage]
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
    if (!tradingEngine.accountState.isActive) return;
    tradingEngine.placeTrade(symbol, "long", 1, price);
  }, [symbol, tradingEngine]);

  const handleSell = useCallback((price: number) => {
    if (!tradingEngine.accountState.isActive) return;
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
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)", padding: currentPage === "trade" ? "0 7px 7px" : "0" }}>

      {/* ═══ Agent Control Overlay (frosted glass + cursor) ═══ */}
      <AgentControlOverlay
        isActive={agentControl.isActive}
        cursorPosition={agentControl.cursorPosition}
        highlightedTarget={agentControl.highlightedTarget}
        statusLabel={agentControl.statusLabel}
        progress={agentControl.progress}
        onCancel={agentControl.cancelControl}
      />

      {/* ═══ Top Navigation Bar ═══ */}
      <Navbar1
        activePage={currentPage}
        onPageChange={navigateTo}
        onOpenCopilot={() => { if (currentPage !== "alpha") setShowAlphySidePanel(prev => !prev); }}
        onOpenRiskMgmt={() => setShowRiskMgmt(true)}
        onOpenSymbols={() => setShowSymbols(true)}
        onOpenSettings={() => navigateTo(currentPage === "settings" ? "dashboard" : "settings")}
        userName={userName}
        userId={userId}
      />

      {/* ═══ Page Content (with optional Alphy panel on left) ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ═══ Alphy Side Panel (left, pushes content — always mounted to preserve scroll) ═══ */}
        <CopilotOverlay
          isOpen={showAlphySidePanel}
          onClose={() => setShowAlphySidePanel(false)}
          messages={messages}
          onSendMessage={handleSubmitStreaming}
          isLoading={isLoading}
          symbol={symbol}
          streamingText={agentStream.streamingText}
          toolEvents={agentStream.toolEvents}
          agentError={agentStream.error}
          liveTokenUsage={agentStream.liveTokenUsage}
          onNewChat={handleNewChat}
          conversations={convexConversations ?? []}
          activeConversationId={activeConversationId as string | null}
          onSelectConversation={(id) => handleSelectConversation(id as typeof activeConversationId)}
          onDeleteConversation={(id) => handleDeleteConversation(id as typeof activeConversationId)}
          currentPage={currentPage}
        />

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
            showAccountMetrics={tradingEngine.accountState.isActive}
            tradingDisabled={!tradingEngine.accountState.isActive}
            onOpenJournal={() => setShowJournalPanel(prev => !prev)}
            showJournal={showJournalPanel}
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
            onResetAccount={tradingEngine.resetAccount}
            onLogoutTrading={tradingEngine.logoutAccount}
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

              {/* ═══ Journal Panel (right side) ═══ */}
              <JournalPanel
                isOpen={showJournalPanel}
                onClose={() => setShowJournalPanel(false)}
                onExpand={() => { setShowJournalPanel(false); navigateTo("journal"); }}
                chartContainerRef={chartContainerRef}
              />
          </div>
        </>
      )}

      {currentPage === "dashboard" && (
        <DashboardPage
          accountState={tradingEngine.accountState}
          onNavigateToChart={(ticker) => { setSymbol(ticker); navigateTo("trade"); }}
          onNavigateToPage={(page) => navigateTo(page)}
          onOpenCopilot={() => setShowAlphySidePanel(prev => !prev)}
        />
      )}

      {currentPage === "journal" && (
        <JournalPage
          onBack={() => navigateTo("dashboard")}
        />
      )}

      {currentPage === "library" && (
        <LibraryPage
          onBack={() => navigateTo("dashboard")}
        />
      )}

      {currentPage === "portfolio" && (
        <PortfolioPage
          accountState={tradingEngine.accountState}
          currentPrice={currentPrice}
          onNavigateToChart={(ticker) => { setSymbol(ticker); navigateTo("trade"); }}
          onPageChange={navigateTo}
          onOpenSettings={() => navigateTo("settings")}
        />
      )}

      {currentPage === "news" && (
        <NewsPage
          onClose={() => navigateTo("dashboard")}
          onNavigateToChart={(ticker) => {
            setSymbol(ticker);
            navigateTo("trade");
          }}
        />
      )}

      {currentPage === "alpha" && (
        <AlphaPlayground
          onNavigateToChart={(ticker) => {
            setSymbol(ticker);
            navigateTo("trade");
          }}
        />
      )}

      {currentPage === "settings" && (
        <SettingsPage
          settings={appSettings}
          onUpdateSettings={setAppSettings}
          riskSettings={riskSettings}
          onUpdateRiskSettings={setRiskSettings}
          onBack={() => navigateTo("dashboard")}
        />
      )}

      {FOOTER_PAGE_IDS.has(currentPage) && (
        <FooterPage
          pageId={currentPage as FooterPageId}
          onBack={() => navigateTo("dashboard")}
        />
      )}
        </div>
      </div>

      {/* ═══ Logout Prompt ═══ */}
      <AnimatePresence>
        {showLogoutPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                background: "var(--bg-raised)", borderRadius: 16,
                border: "1px solid var(--glass-border)", padding: "32px 28px",
                maxWidth: 340, width: "90%", textAlign: "center",
                boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px",
                background: "rgba(196,123,58,0.12)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="10" fill="var(--accent)" />
                  <circle cx="11" cy="13" r="2" fill="#fff" />
                  <circle cx="21" cy="13" r="2" fill="#fff" />
                  <path d="M11 20 Q16 23 21 20" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-mono)", marginBottom: 8,
              }}>
                Leaving already?
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-muted)",
                fontFamily: "var(--font-mono)", lineHeight: 1.5, marginBottom: 24,
              }}>
                You&apos;ll be signed out and returned to the landing page.
              </div>
              <div className="flex items-center justify-center" style={{ gap: 10 }}>
                <button
                  onClick={() => setShowLogoutPrompt(false)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    background: "transparent", border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
                    fontFamily: "var(--font-mono)", cursor: "pointer",
                    transition: "border-color 120ms ease, color 120ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  Stay
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    background: "var(--accent)", border: "1px solid var(--accent)",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    fontFamily: "var(--font-mono)", cursor: "pointer",
                    transition: "opacity 120ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ═══ Dev Navigation Panel (development only) ═══ */}
      {process.env.NODE_ENV === "development" && (
        <div style={{
          position: "fixed", bottom: 12, right: 12, zIndex: 99999,
          background: "rgba(26,23,20,0.95)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(196,123,58,0.3)", borderRadius: 10,
          padding: "6px 8px", display: "flex", gap: 4, alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
        }}>
          <span style={{ color: "rgba(196,123,58,0.6)", padding: "0 4px", userSelect: "none" }}>DEV</span>
          {(["landing", "login", "onboarding"] as const).map((r) => (
            <button
              key={r}
              onClick={() => window.location.href = `/${r === "landing" ? "landing" : r}`}
              style={{
                padding: "3px 7px", borderRadius: 5, border: "1px dashed rgba(196,123,58,0.2)", cursor: "pointer",
                background: "transparent", color: "rgba(236,227,213,0.3)",
                fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                transition: "all 80ms ease", textTransform: "capitalize",
              }}
            >
              {r}
            </button>
          ))}
          <span style={{ width: 1, height: 12, background: "rgba(236,227,213,0.1)" }} />
          {(["dashboard", "trade", "journal", "library", "portfolio", "news", "alpha", "settings"] as AppPage[]).map((p) => (
            <button
              key={p}
              onClick={() => navigateTo(p)}
              style={{
                padding: "3px 7px", borderRadius: 5, border: "none", cursor: "pointer",
                background: currentPage === p ? "rgba(196,123,58,0.25)" : "transparent",
                color: currentPage === p ? "#c47b3a" : "rgba(236,227,213,0.45)",
                fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                transition: "all 80ms ease", textTransform: "capitalize",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
