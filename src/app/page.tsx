"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import Chart from "@/components/Chart/Chart";
import Navbar1 from "@/components/Navbar1/Navbar1";
import Navbar2 from "@/components/Navbar2/Navbar2";
import LeftSidebar from "@/components/LeftSidebar/LeftSidebar";
import type { DrawingTool } from "@/components/LeftSidebar/LeftSidebar";
import FloatingTradeWidget from "@/components/FloatingTradeWidget/FloatingTradeWidget";
import PositionsPanel from "@/components/PositionsPanel/PositionsPanel";
import CopilotOverlay from "@/components/CopilotOverlay/CopilotOverlay";
import SymbolsSearch from "@/components/SymbolsSearch/SymbolsSearch";
import RiskManagement from "@/components/RiskManagement/RiskManagement";
import SettingsPanel from "@/components/SettingsPanel/SettingsPanel";
import NewsPage from "@/components/NewsPage/NewsPage";
import StatusBar from "@/components/StatusBar/StatusBar";
import { useTradingEngine } from "@/hooks/useTradingEngine";
import { sendChatMessage, fetchOHLCV, fetchTicks } from "@/lib/api";
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
} from "@/lib/types";

export default function Home() {
  // ═══════════════════════════════════════════════
  // DATA STATE
  // ═══════════════════════════════════════════════
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbol, setSymbol] = useState("NQ=F");
  const [interval, setInterval] = useState("1d");

  // Backtest state
  const [trades, setTrades] = useState<Trade[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [equityCurve, setEquityCurve] = useState<{ time: number; value: number }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [strategyName, setStrategyName] = useState<string>("");

  // Chat / AI Copilot state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      tradingEngine.updatePrices(currentPrice);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice]);

  // ═══════════════════════════════════════════════
  // UI PANEL STATE (overlays, sidebars, modals)
  // ═══════════════════════════════════════════════
  const [showCopilot, setShowCopilot] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const [showRiskMgmt, setShowRiskMgmt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTradeWidget, setShowTradeWidget] = useState(true);
  const [showNewsFeed, setShowNewsFeed] = useState(false);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [chartTheme, setChartTheme] = useState<"dark" | "light">("dark");
  const [selectMode, setSelectMode] = useState<"date" | "random" | "bar" | null>(null);

  // Risk settings
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    maxOpenPositions: null,
    allowedSymbols: [],
    requireSlTp: false,
    maxLossPerTradePct: null,
    presetSlPct: null,
    presetTpPct: null,
  });

  // App settings
  const [appSettings, setAppSettings] = useState<AppSettings>({
    oneClickTrading: false,
    tradeExecutionSound: true,
    showNotifications: true,
    notificationDuration: 3,
    showTradeHistoryOnChart: false,
    bigLotThreshold: 10,
    showBuySellButtons: true,
    showPositionsOnChart: true,
    reversePositionButton: false,
    showPnlOnChart: true,
  });

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
      const newHeight = Math.max(75, Math.min(window.innerHeight * 0.5, startHeightRef.current + delta));
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
      case "1m": case "3m": return "5d";
      case "5m": case "15m": case "30m": return "60d";
      case "1h": case "4h": return "1y";
      case "1d": return "2y";
      case "1wk": return "5y";
      default: return "1y";
    }
  };

  const getIntervalSeconds = useCallback((iv: string): number => {
    switch (iv) {
      case "1m": return 60;
      case "3m": return 180;
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
        setTicks(tickData);
        setReplayState((prev) => ({
          ...prev, tickMode: true, totalTicks: tickData.length,
          currentTickIndex: tickData.length, currentBarIndex: 0, totalBars: 0,
          progress: 100, isPlaying: false,
        }));
      } catch (err) { console.error("Failed to fetch tick data:", err); }
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
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchOHLCV({ symbol, period: getPeriodForInterval(interval), interval });
        const candleData = result?.candles ?? [];
        setCandles(candleData);
        if (!tickMode) {
          setReplayState((prev) => ({
            ...prev, totalBars: candleData.length, currentBarIndex: candleData.length,
            isPlaying: false, progress: 100, tickMode: false, currentTickIndex: 0, totalTicks: 0,
          }));
        }
      } catch (err) { console.error("Failed to fetch data:", err); }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant", content: response.message,
          timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
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
    [messages, symbol, interval]
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
      // Ctrl+S → Symbols search
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowSymbols(true);
      }
      // Ctrl+A → Quick trade (toggle widget)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setShowTradeWidget((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg)", padding: "0 7px 7px" }}>

      {/* ═══ Navbar 1: Top navigation bar (82px) ═══ */}
      <Navbar1
        onOpenCopilot={() => setShowCopilot(true)}
        onOpenRiskMgmt={() => setShowRiskMgmt(true)}
        onOpenSymbols={() => setShowSymbols(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleNewsFeed={() => setShowNewsFeed(prev => !prev)}
        showNewsFeed={showNewsFeed}
        accountState={tradingEngine.accountState}
        currentPrice={currentPrice}
        onCloseAll={handleCloseAll}
        onCloseAllProfitable={() => tradingEngine.closeAllProfitable(currentPrice)}
        onCloseAllLosing={() => tradingEngine.closeAllLosing(currentPrice)}
        onResetAccount={tradingEngine.resetAccount}
      />

      {/* ═══ Navbar 2: Account info + chart controls (64px) ═══ */}
      <Navbar2
        symbol={symbol}
        onSymbolChange={setSymbol}
        interval={interval}
        onIntervalChange={setInterval}
        tickMode={tickMode}
        onTickModeChange={setTickMode}
        chartTheme={chartTheme}
        onChartThemeChange={setChartTheme}
        accountState={tradingEngine.accountState}
        onOpenTrade={() => setShowTradeWidget(true)}
      />

      {/* ═══ Main Content: Left Sidebar + Chart / News Page ═══ */}
      <div className="flex flex-1 min-h-0">
        {showNewsFeed ? (
          /* ─── Full-page News & Research View ─── */
          <NewsPage onClose={() => setShowNewsFeed(false)} />
        ) : (
          <>
            {/* Left drawing tools sidebar */}
            <LeftSidebar
              activeTool={drawingTool}
              onToolChange={setDrawingTool}
              drawingsVisible={drawingsVisible}
              onToggleVisibility={() => setDrawingsVisible(prev => !prev)}
              magnetEnabled={magnetEnabled}
              onToggleMagnet={() => setMagnetEnabled(prev => !prev)}
            />

            {/* Chart area */}
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
                theme={chartTheme}
                positions={appSettings.showPositionsOnChart ? tradingEngine.accountState.positions : []}
                currentPrice={currentPrice}
                onBuyMarket={handleBuy}
                onSellMarket={handleSell}
                onBuyLimit={(price) => tradingEngine.placeTrade(symbol, "long", 1, price)}
                onSellLimit={(price) => tradingEngine.placeTrade(symbol, "short", 1, price)}
                onClosePosition={handleClosePosition}
                showBuySellButtons={appSettings.showBuySellButtons}
              />

              {/* Floating Bid/Ask trade widget */}
              <FloatingTradeWidget
                currentPrice={currentPrice}
                spread={spread}
                symbol={symbol}
                onBuy={handleBuy}
                onSell={handleSell}
                visible={showTradeWidget}
              />
            </div>
          </>
        )}
      </div>

      {/* ═══ Resize Handle ═══ */}
      <div
        onMouseDown={handleDragStart}
        className="flex-shrink-0 flex items-center justify-center cursor-row-resize group"
        style={{ height: 5, borderTop: "0.667px solid rgba(236,227,213,0.15)" }}
      >
        <div
          className="w-10 h-[2px] rounded-full transition-colors group-hover:bg-[rgba(236,227,213,0.15)]"
          style={{ background: "rgba(236,227,213,0.06)" }}
        />
      </div>

      {/* ═══ Bottom Panel: Positions/Orders/History + Playback ═══ */}
      <div className="flex-shrink-0" style={{ height: bottomHeight }}>
        <PositionsPanel
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
        />
      </div>

      {/* ═══ Status Bar ═══ */}
      <StatusBar
        symbol={symbol}
        interval={tickMode ? `${interval} (Tick)` : interval}
        candleCount={tickMode ? ticks.length : candles.length}
      />

      {/* ═══ OVERLAYS ═══ */}

      {/* AI Copilot — Full-screen overlay */}
      <AnimatePresence>
        {showCopilot && (
          <CopilotOverlay
            isOpen={showCopilot}
            onClose={() => setShowCopilot(false)}
            messages={messages}
            onSendMessage={handleSubmit}
            isLoading={isLoading}
            symbol={symbol}
          />
        )}
      </AnimatePresence>

      {/* Symbols Search — Full overlay */}
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

      {/* Risk Management — Modal */}
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

      {/* Settings — Right sidebar */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={appSettings}
            onUpdateSettings={setAppSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
