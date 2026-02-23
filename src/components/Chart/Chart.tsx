"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type UTCTimestamp,
  type Time,
  type IPriceLine,
  ColorType,
} from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";
import type { Candle, Trade, Position } from "@/lib/types";

// ─── Context Menu Types ───
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  price: number;
}

interface ChartProps {
  candles: Candle[];
  trades?: Trade[];
  visibleBars?: number;
  symbol?: string;
  interval?: string;
  replayBarIndex?: number;
  activeTool?: string;
  onChartClick?: (barIndex: number, price: number) => void;
  theme?: "dark" | "light";
  // ─── NEW: Trading integration props ───
  positions?: Position[];
  currentPrice?: number;
  onBuyLimit?: (price: number) => void;
  onSellLimit?: (price: number) => void;
  onBuyMarket?: (price: number) => void;
  onSellMarket?: (price: number) => void;
  onClosePosition?: (id: string) => void;
  onAddAlert?: (price: number) => void;
  showBuySellButtons?: boolean;
}

export default function Chart({
  candles,
  trades,
  visibleBars,
  symbol,
  interval,
  replayBarIndex,
  activeTool,
  onChartClick,
  theme = "dark",
  positions = [],
  currentPrice = 0,
  onBuyLimit,
  onSellLimit,
  onBuyMarket,
  onSellMarket,
  onClosePosition,
  onAddAlert,
  showBuySellButtons = true,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const onChartClickRef = useRef(onChartClick);
  const candlesRef = useRef(candles);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [crosshairData, setCrosshairData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePct: number;
  } | null>(null);
  const [replayLineX, setReplayLineX] = useState<number | null>(null);

  // ─── Context menu state ───
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, price: 0,
  });

  // ─── Buy/Sell buttons Y position (tracks current price on chart) ───
  const [buySellY, setBuySellY] = useState<number | null>(null);

  // ─── Alert lines ───
  const [alertLines, setAlertLines] = useState<{ price: number; id: string }[]>([]);
  const alertPriceLinesRef = useRef<IPriceLine[]>([]);

  // Keep refs up to date
  useEffect(() => {
    onChartClickRef.current = onChartClick;
  }, [onChartClick]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleClose = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      window.addEventListener("click", handleClose);
      window.addEventListener("scroll", handleClose, true);
      return () => {
        window.removeEventListener("click", handleClose);
        window.removeEventListener("scroll", handleClose, true);
      };
    }
  }, [contextMenu.visible]);

  // Initialize chart (re-creates on theme change)
  useEffect(() => {
    if (!containerRef.current) return;

    const isLight = theme === "light";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isLight ? "#ffffff" : "transparent" },
        textColor: isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.35)",
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isLight ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.03)" },
        horzLines: { color: isLight ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.03)" },
      },
      crosshair: {
        vertLine: {
          color: isLight ? "rgba(0,0,0,0.3)" : "rgba(196,123,58,0.4)",
          width: 1, style: 2,
          labelBackgroundColor: isLight ? "#333333" : "#c47b3a",
        },
        horzLine: {
          color: isLight ? "rgba(0,0,0,0.3)" : "rgba(196,123,58,0.4)",
          width: 1, style: 2,
          labelBackgroundColor: isLight ? "#333333" : "#c47b3a",
        },
      },
      rightPriceScale: {
        borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.05)",
        scaleMargins: { top: 0.08, bottom: 0.18 },
        textColor: isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.3)",
      },
      timeScale: {
        borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.05)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        minBarSpacing: 3,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, isLight ? {
      upColor: "#26a65b",
      downColor: "#131722",
      borderUpColor: "#131722",
      borderDownColor: "#131722",
      wickUpColor: "#131722",
      wickDownColor: "#131722",
    } : {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "rgba(34,197,94,0.6)",
      wickDownColor: "rgba(239,68,68,0.6)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // Crosshair move handler for OHLCV status bar
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeries);
      const volumeData = param.seriesData.get(volumeSeries);
      if (candleData && "open" in candleData) {
        const change = candleData.close - candleData.open;
        const changePct = (change / candleData.open) * 100;
        setCrosshairData({
          time: String(param.time),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData && "value" in volumeData ? volumeData.value : 0,
          change,
          changePct,
        });
      }
    });

    // Click handler for select-bar mode
    chart.subscribeClick((param) => {
      if (!onChartClickRef.current || !param.time) return;
      const clickedTime = param.time as number;
      const candleData = param.seriesData?.get(candleSeries);
      if (candleData && "close" in candleData) {
        const idx = candlesRef.current.findIndex(c => c.time === clickedTime);
        if (idx >= 0) {
          onChartClickRef.current(idx, candleData.close);
        }
      }
    });

    // ─── Right-click context menu handler ───
    const chartEl = chart.chartElement();
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = chartEl.getBoundingClientRect();
      const localY = e.clientY - rect.top;
      const price = candleSeries.coordinateToPrice(localY);
      if (price !== null) {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          price: price,
        });
      }
    };
    chartEl.addEventListener("contextmenu", handleContextMenu);

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      chartEl.removeEventListener("contextmenu", handleContextMenu);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      alertPriceLinesRef.current = [];
    };
  }, [theme]);

  // Update candle data
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || candles.length === 0)
      return;

    const displayCandles = visibleBars
      ? candles.slice(0, visibleBars)
      : candles;

    const candleData = displayCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const isLight = theme === "light";
    const volumeData = displayCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color:
        c.close >= c.open
          ? isLight ? "rgba(38,166,91,0.15)" : "rgba(34,197,94,0.12)"
          : isLight ? "rgba(19,23,34,0.10)" : "rgba(239,68,68,0.12)",
    }));

    seriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
  }, [candles, visibleBars, theme]);

  // Update trade markers
  useEffect(() => {
    if (!seriesRef.current) return;

    if (markersRef.current) {
      markersRef.current.detach();
      markersRef.current = null;
    }

    if (!trades || trades.length === 0) return;

    const markers = trades.flatMap((trade) => {
      const result = [];
      result.push({
        time: trade.entryTime as UTCTimestamp,
        position:
          trade.side === "long"
            ? ("belowBar" as const)
            : ("aboveBar" as const),
        color: trade.side === "long" ? "#22c55e" : "#ef4444",
        shape:
          trade.side === "long"
            ? ("arrowUp" as const)
            : ("arrowDown" as const),
        text: `${trade.side === "long" ? "BUY" : "SELL"} @ ${trade.entryPrice.toFixed(2)}`,
      });
      result.push({
        time: trade.exitTime as UTCTimestamp,
        position: "aboveBar" as const,
        color: trade.pnl >= 0 ? "#22c55e" : "#ef4444",
        shape: "circle" as const,
        text: `EXIT ${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}`,
      });
      return result;
    });

    markers.sort((a, b) => (a.time as number) - (b.time as number));

    markersRef.current = createSeriesMarkers(seriesRef.current, markers);
  }, [trades]);

  // ─── Position price lines (entry, SL, TP) ───
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;

    // Remove old price lines
    for (const line of priceLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* already removed */ }
    }
    priceLinesRef.current = [];

    if (!positions || positions.length === 0) return;

    const isLight = theme === "light";

    for (const pos of positions) {
      // Entry price line
      const entryColor = pos.side === "long"
        ? (isLight ? "#26a65b" : "#22c55e")
        : (isLight ? "#dc2626" : "#ef4444");

      const pnlText = pos.unrealizedPnl >= 0
        ? `+$${pos.unrealizedPnl.toFixed(2)}`
        : `-$${Math.abs(pos.unrealizedPnl).toFixed(2)}`;

      const entryLine = series.createPriceLine({
        price: pos.entryPrice,
        color: entryColor,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${pos.side === "long" ? "LONG" : "SHORT"} @ ${pos.entryPrice.toFixed(2)}  ${pnlText}`,
        axisLabelColor: entryColor,
        axisLabelTextColor: "#ffffff",
      });
      priceLinesRef.current.push(entryLine);

      // Stop Loss line
      if (pos.stopLoss !== null) {
        const slLine = series.createPriceLine({
          price: pos.stopLoss,
          color: isLight ? "#dc2626" : "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL ${pos.stopLoss.toFixed(2)}`,
          axisLabelColor: isLight ? "#dc2626" : "#ef4444",
          axisLabelTextColor: "#ffffff",
        });
        priceLinesRef.current.push(slLine);
      }

      // Take Profit line
      if (pos.takeProfit !== null) {
        const tpLine = series.createPriceLine({
          price: pos.takeProfit,
          color: isLight ? "#16a34a" : "#22c55e",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP ${pos.takeProfit.toFixed(2)}`,
          axisLabelColor: isLight ? "#16a34a" : "#22c55e",
          axisLabelTextColor: "#ffffff",
        });
        priceLinesRef.current.push(tpLine);
      }
    }
  }, [positions, theme, currentPrice]);

  // ─── Alert price lines ───
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;

    for (const line of alertPriceLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* */ }
    }
    alertPriceLinesRef.current = [];

    for (const alert of alertLines) {
      const alertLine = series.createPriceLine({
        price: alert.price,
        color: "#f59e0b",
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: `ALERT ${alert.price.toFixed(2)}`,
        axisLabelColor: "#f59e0b",
        axisLabelTextColor: "#000000",
      });
      alertPriceLinesRef.current.push(alertLine);
    }
  }, [alertLines]);

  // ─── Update buy/sell button Y position based on current price ───
  useEffect(() => {
    if (!seriesRef.current || currentPrice <= 0) {
      setBuySellY(null);
      return;
    }

    const updateY = () => {
      if (!seriesRef.current) return;
      try {
        const y = seriesRef.current.priceToCoordinate(currentPrice);
        setBuySellY(y !== null ? y : null);
      } catch {
        setBuySellY(null);
      }
    };

    updateY();

    // Update on crosshair move (effectively on every frame during interaction)
    if (chartRef.current) {
      const chart = chartRef.current;
      chart.timeScale().subscribeVisibleLogicalRangeChange(updateY);
      return () => {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateY);
        } catch { /* chart may be disposed */ }
      };
    }
  }, [currentPrice, candles, theme]);

  // Update replay line position
  const updateReplayLinePosition = useCallback(() => {
    if (replayBarIndex === undefined || replayBarIndex === null || !chartRef.current || !seriesRef.current || candles.length === 0) {
      setReplayLineX(null);
      return;
    }

    const displayCandles = visibleBars ? candles.slice(0, visibleBars) : candles;
    if (replayBarIndex >= displayCandles.length) {
      setReplayLineX(null);
      return;
    }

    const barTime = displayCandles[replayBarIndex]?.time;
    if (!barTime) {
      setReplayLineX(null);
      return;
    }

    try {
      const coord = chartRef.current.timeScale().timeToCoordinate(barTime as UTCTimestamp);
      setReplayLineX(coord !== null ? coord : null);
    } catch {
      setReplayLineX(null);
    }
  }, [replayBarIndex, candles, visibleBars]);

  useEffect(() => {
    updateReplayLinePosition();
  }, [updateReplayLinePosition]);

  // Also update replay line on scroll/zoom
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    chart.timeScale().subscribeVisibleLogicalRangeChange(updateReplayLinePosition);
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateReplayLinePosition);
      } catch { /* chart may be disposed */ }
    };
  }, [updateReplayLinePosition]);

  // ─── Context menu action handlers ───
  const handleCopyPrice = useCallback(() => {
    navigator.clipboard.writeText(contextMenu.price.toFixed(2));
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.price]);

  const handleBuyLimitAtPrice = useCallback(() => {
    onBuyLimit?.(contextMenu.price);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.price, onBuyLimit]);

  const handleSellLimitAtPrice = useCallback(() => {
    onSellLimit?.(contextMenu.price);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.price, onSellLimit]);

  const handleAddAlertAtPrice = useCallback(() => {
    const price = contextMenu.price;
    setAlertLines(prev => [...prev, { price, id: `alert-${Date.now()}` }]);
    onAddAlert?.(price);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [contextMenu.price, onAddAlert]);

  const handleResetChartView = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.timeScale().scrollToRealTime();
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleRemoveAlerts = useCallback(() => {
    setAlertLines([]);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Compute latest bar info for the header
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const displayData = crosshairData || (lastCandle ? {
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
    volume: lastCandle.volume,
    change: lastCandle.close - lastCandle.open,
    changePct: ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100,
  } : null);

  // Set cursor based on active tool
  const chartCursor = activeTool && activeTool !== "crosshair" ? "crosshair" : "default";
  const isLightMode = theme === "light";
  const buyColor = isLightMode ? "#26a65b" : "var(--buy)";
  const sellColor = isLightMode ? "#131722" : "var(--sell)";
  const mutedColor = isLightMode ? "rgba(0,0,0,0.45)" : "var(--text-muted)";
  const primaryColor = isLightMode ? "#131722" : "var(--text-secondary)";

  return (
    <div className="relative w-full h-full" style={{ background: isLightMode ? "#ffffff" : undefined }}>
      {/* OHLCV Status Bar */}
      {displayData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 left-3 z-10 flex items-center gap-3 text-[10px] font-mono"
          style={{ color: mutedColor }}
        >
          {symbol && (
            <span className="font-semibold text-[11px]" style={{ color: primaryColor }}>
              {symbol}
            </span>
          )}
          {interval && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)", color: mutedColor }}>
              {interval}
            </span>
          )}
          <span>
            O <span style={{ color: displayData.open <= displayData.close ? buyColor : sellColor }} className="tabular-nums">
              {displayData.open.toFixed(2)}
            </span>
          </span>
          <span>
            H <span style={{ color: buyColor }} className="tabular-nums">{displayData.high.toFixed(2)}</span>
          </span>
          <span>
            L <span style={{ color: sellColor }} className="tabular-nums">{displayData.low.toFixed(2)}</span>
          </span>
          <span>
            C <span style={{ color: displayData.close >= displayData.open ? buyColor : sellColor }} className="tabular-nums">
              {displayData.close.toFixed(2)}
            </span>
          </span>
          <span style={{
            color: displayData.change >= 0 ? buyColor : sellColor,
            fontWeight: 600,
          }} className="tabular-nums">
            {displayData.change >= 0 ? "+" : ""}{displayData.change.toFixed(2)} ({displayData.changePct >= 0 ? "+" : ""}{displayData.changePct.toFixed(2)}%)
          </span>
          {displayData.volume > 0 && (
            <span className="tabular-nums">
              Vol {displayData.volume >= 1000 ? `${(displayData.volume / 1000).toFixed(1)}K` : displayData.volume}
            </span>
          )}
        </motion.div>
      )}

      {/* Watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
        style={{ opacity: isLightMode ? 0.06 : 0.03 }}
      >
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 72, fontWeight: 400, fontStyle: "italic", letterSpacing: "-0.02em", color: isLightMode ? "#000" : undefined }}>
          <span style={{ color: isLightMode ? "#c47b3a" : "var(--accent)" }}>α</span>Findr
        </span>
      </div>

      {/* Blue Replay Line (scissors line) */}
      {replayLineX !== null && (
        <div
          className="absolute top-0 pointer-events-none z-20"
          style={{
            left: replayLineX,
            height: "100%",
            width: 0,
            borderLeft: "2px dashed rgba(59, 130, 246, 0.7)",
          }}
        >
          {/* Scissors icon at top of line */}
          <div
            style={{
              position: "absolute",
              top: 4,
              left: -10,
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(59, 130, 246, 0.9)",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </div>
          {/* Label at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: -30,
              background: "rgba(59, 130, 246, 0.9)",
              color: "white",
              padding: "2px 6px",
              borderRadius: 3,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            REPLAY
          </div>
        </div>
      )}

      {/* ─── Buy/Sell Buttons on Right Edge ─── */}
      {showBuySellButtons && buySellY !== null && currentPrice > 0 && onBuyMarket && onSellMarket && (
        <div
          className="absolute z-30 pointer-events-auto"
          style={{
            right: 65,
            top: buySellY - 12,
          }}
        >
          <div className="flex flex-col gap-px">
            <button
              onClick={() => onBuyMarket(currentPrice)}
              className="text-[9px] font-bold px-2 py-0.5 rounded-sm transition-all hover:brightness-110"
              style={{
                background: "#22c55e",
                color: "white",
                border: "none",
                cursor: "pointer",
                lineHeight: "12px",
                letterSpacing: "0.05em",
              }}
            >
              BUY
            </button>
            <button
              onClick={() => onSellMarket(currentPrice)}
              className="text-[9px] font-bold px-2 py-0.5 rounded-sm transition-all hover:brightness-110"
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                cursor: "pointer",
                lineHeight: "12px",
                letterSpacing: "0.05em",
              }}
            >
              SELL
            </button>
          </div>
        </div>
      )}

      {/* ─── Position Labels on Chart (floating PnL) ─── */}
      {positions.map((pos) => {
        if (!seriesRef.current) return null;
        let y: number | null = null;
        try {
          y = seriesRef.current.priceToCoordinate(pos.entryPrice);
        } catch { /* */ }
        if (y === null) return null;

        const isLong = pos.side === "long";
        const pnlColor = pos.unrealizedPnl >= 0 ? "#22c55e" : "#ef4444";
        const pnlText = pos.unrealizedPnl >= 0
          ? `+$${pos.unrealizedPnl.toFixed(2)}`
          : `-$${Math.abs(pos.unrealizedPnl).toFixed(2)}`;

        return (
          <div
            key={pos.id}
            className="absolute z-20 pointer-events-auto flex items-center gap-1"
            style={{
              left: 8,
              top: y - 10,
            }}
          >
            {/* Position badge */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold"
              style={{
                background: isLong ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: isLong ? "#22c55e" : "#ef4444",
                border: `1px solid ${isLong ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}
            >
              {isLong ? "▲" : "▼"} {pos.size}
              <span style={{ color: pnlColor, marginLeft: 4 }}>{pnlText}</span>
            </div>
            {/* Close button */}
            {onClosePosition && (
              <button
                onClick={() => onClosePosition(pos.id)}
                className="flex items-center justify-center rounded-sm transition-all hover:brightness-125"
                style={{
                  width: 14, height: 14,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  padding: 0,
                }}
                title="Close position"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? "#666" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {/* ─── Right-Click Context Menu ─── */}
      <AnimatePresence>
        {contextMenu.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9999]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: isLightMode ? "#ffffff" : "rgba(24,24,28,0.98)",
                border: `1px solid ${isLightMode ? "rgba(0,0,0,0.12)" : "rgba(236,227,213,0.12)"}`,
                borderRadius: 8,
                boxShadow: isLightMode
                  ? "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)"
                  : "0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
                minWidth: 220,
                padding: "4px 0",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Price header */}
              <div
                style={{
                  padding: "6px 12px 4px",
                  fontSize: 10,
                  color: isLightMode ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.4)",
                  fontFamily: "var(--font-mono)",
                  borderBottom: `1px solid ${isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)"}`,
                  marginBottom: 2,
                }}
              >
                Price: {contextMenu.price.toFixed(2)}
              </div>

              {/* Trading Actions */}
              {onBuyLimit && (
                <ContextMenuItem
                  icon={<span style={{ color: "#22c55e", fontWeight: 700 }}>▲</span>}
                  label={`Buy Limit @ ${contextMenu.price.toFixed(2)}`}
                  onClick={handleBuyLimitAtPrice}
                  isLight={isLightMode}
                  accentColor="#22c55e"
                />
              )}
              {onSellLimit && (
                <ContextMenuItem
                  icon={<span style={{ color: "#ef4444", fontWeight: 700 }}>▼</span>}
                  label={`Sell Limit @ ${contextMenu.price.toFixed(2)}`}
                  onClick={handleSellLimitAtPrice}
                  isLight={isLightMode}
                  accentColor="#ef4444"
                />
              )}

              {(onBuyLimit || onSellLimit) && (
                <div style={{ height: 1, background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)", margin: "2px 0" }} />
              )}

              {/* Alert */}
              <ContextMenuItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }
                label={`Add Alert @ ${contextMenu.price.toFixed(2)}`}
                onClick={handleAddAlertAtPrice}
                isLight={isLightMode}
              />

              <div style={{ height: 1, background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)", margin: "2px 0" }} />

              {/* Chart Actions */}
              <ContextMenuItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? "#666" : "rgba(236,227,213,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                }
                label="Copy Price"
                onClick={handleCopyPrice}
                isLight={isLightMode}
                shortcut="Ctrl+C"
              />

              <ContextMenuItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? "#666" : "rgba(236,227,213,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                }
                label="Reset Chart View"
                onClick={handleResetChartView}
                isLight={isLightMode}
              />

              {alertLines.length > 0 && (
                <ContextMenuItem
                  icon={
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  }
                  label={`Remove All Alerts (${alertLines.length})`}
                  onClick={handleRemoveAlerts}
                  isLight={isLightMode}
                />
              )}

              {/* Close positions from context menu */}
              {positions.length > 0 && (
                <>
                  <div style={{ height: 1, background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)", margin: "2px 0" }} />
                  {positions.map(pos => (
                    <ContextMenuItem
                      key={pos.id}
                      icon={<span style={{ color: pos.side === "long" ? "#22c55e" : "#ef4444", fontSize: 10 }}>{pos.side === "long" ? "▲" : "▼"}</span>}
                      label={`Close ${pos.side.toUpperCase()} ${pos.size} @ ${pos.entryPrice.toFixed(2)}`}
                      onClick={() => {
                        onClosePosition?.(pos.id);
                        setContextMenu(prev => ({ ...prev, visible: false }));
                      }}
                      isLight={isLightMode}
                      accentColor={pos.unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "300px", cursor: chartCursor }}
      />
    </div>
  );
}

// ─── Context Menu Item Component ───
function ContextMenuItem({
  icon,
  label,
  onClick,
  isLight,
  shortcut,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isLight: boolean;
  shortcut?: string;
  accentColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        color: accentColor || (isLight ? "#333" : "rgba(236,227,213,0.85)"),
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(236,227,213,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 16 }}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span style={{
          fontSize: 9,
          color: isLight ? "rgba(0,0,0,0.3)" : "rgba(236,227,213,0.3)",
          fontFamily: "var(--font-mono)",
        }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}
