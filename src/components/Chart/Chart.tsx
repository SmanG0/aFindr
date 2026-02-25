"use client";

// Suppress harmless "Object is disposed" errors from lightweight-charts.
// The library schedules internal requestAnimationFrame paints that can fire
// after chart.remove() disposes the canvas binding. This is a known lifecycle
// issue — the error is harmless but crashes Next.js dev overlay. We wrap rAF
// to catch it at the source, before it can propagate to any error handler.
if (typeof window !== "undefined" && !(window as unknown as Record<string, boolean>).__lwcRafPatched) {
  (window as unknown as Record<string, boolean>).__lwcRafPatched = true;
  const _origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb: FrameRequestCallback): number {
    return _origRAF.call(window, (time: DOMHighResTimeStamp) => {
      try {
        cb(time);
      } catch (e) {
        if (e instanceof Error && e.message === "Object is disposed") return;
        throw e;
      }
    });
  };
}

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
  TickMarkType,
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
import type { IndicatorResult, IndicatorConfig } from "@/lib/indicators";
import { INDICATOR_DEFS } from "@/lib/indicators";
import { LineSeries } from "lightweight-charts";

// ─── Context Menu Types ───
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  price: number;
}

// ─── Chart Appearance Settings ───
export interface ChartAppearance {
  backgroundColor: string;
  upColor: string;
  downColor: string;
  upWickColor: string;
  downWickColor: string;
  borderUpColor: string;
  borderDownColor: string;
  gridColor: string;
}

export const DEFAULT_DARK_APPEARANCE: ChartAppearance = {
  backgroundColor: "transparent",
  upColor: "#22c55e",
  downColor: "#ef4444",
  upWickColor: "rgba(34,197,94,0.6)",
  downWickColor: "rgba(239,68,68,0.6)",
  borderUpColor: "#22c55e",
  borderDownColor: "#ef4444",
  gridColor: "rgba(236,227,213,0.03)",
};

export const DEFAULT_LIGHT_APPEARANCE: ChartAppearance = {
  backgroundColor: "#ffffff",
  upColor: "#26a65b",
  downColor: "#ef5350",
  upWickColor: "#26a65b",
  downWickColor: "#ef5350",
  borderUpColor: "#26a65b",
  borderDownColor: "#ef5350",
  gridColor: "rgba(0,0,0,0.06)",
};

interface ChartProps {
  candles: Candle[];
  trades?: Trade[];
  visibleBars?: number;
  symbol?: string;
  interval?: string;
  replayBarIndex?: number;
  activeTool?: string;
  onChartClick?: (barIndex: number, price: number) => void;
  onDrawingClick?: (time: number, price: number) => void;
  theme?: "dark" | "light";
  appearance?: ChartAppearance;
  onAppearanceChange?: (appearance: ChartAppearance) => void;
  // ─── NEW: Trading integration props ───
  positions?: Position[];
  currentPrice?: number;
  onBuyLimit?: (price: number) => void;
  onSellLimit?: (price: number) => void;
  onBuyMarket?: (price: number) => void;
  onSellMarket?: (price: number) => void;
  onClosePosition?: (id: string) => void;
  onAddAlert?: (price: number) => void;
  onModifyPosition?: (positionId: string, updates: { stopLoss?: number; takeProfit?: number }) => void;
  showBuySellButtons?: boolean;
  spread?: number;
  // ─── Indicators ───
  indicators?: IndicatorResult[];
  indicatorConfigs?: IndicatorConfig[];
  onEditIndicator?: (config: IndicatorConfig) => void;
  // ─── Drawing magnet mode ───
  magnetEnabled?: boolean;
  // ─── Expose chart/series refs for DrawingOverlay ───
  onChartReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick">) => void;
  children?: React.ReactNode;
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
  onDrawingClick,
  theme = "dark",
  appearance,
  onAppearanceChange,
  positions = [],
  currentPrice = 0,
  onBuyLimit,
  onSellLimit,
  onBuyMarket,
  onSellMarket,
  onClosePosition,
  onAddAlert,
  onModifyPosition,
  showBuySellButtons = true,
  spread = 0.25,
  indicators = [],
  indicatorConfigs = [],
  onEditIndicator,
  magnetEnabled = false,
  onChartReady,
  children,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const onChartClickRef = useRef(onChartClick);
  const onDrawingClickRef = useRef(onDrawingClick);
  const magnetEnabledRef = useRef(magnetEnabled);
  const candlesRef = useRef(candles);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const indicatorSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
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

  // ─── Scissors drag state (refs to avoid re-renders during drag) ───
  const isDraggingScissorsRef = useRef(false);
  const activeToolRef = useRef(activeTool);

  // ─── Context menu state ───
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, price: 0,
  });

  // ─── Draggable price-line state (SL/TP drag) ───
  type DragLineType = "sl" | "tp";
  interface PriceLineInfo { positionId: string; lineType: DragLineType; priceLine: IPriceLine }
  const draggableLinesRef = useRef<PriceLineInfo[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dragStateRef = useRef<{
    active: boolean;
    lineInfo: PriceLineInfo | null;
    startY: number;
    startPrice: number;
  }>({ active: false, lineInfo: null, startY: 0, startPrice: 0 });
  const onModifyPositionRef = useRef(onModifyPosition);
  useEffect(() => { onModifyPositionRef.current = onModifyPosition; }, [onModifyPosition]);
  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // ─── Alert lines ───
  const [alertLines, setAlertLines] = useState<{ price: number; id: string }[]>([]);
  const alertPriceLinesRef = useRef<IPriceLine[]>([]);

  // ─── Chart Settings Modal ───
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Keep refs up to date
  useEffect(() => {
    onChartClickRef.current = onChartClick;
  }, [onChartClick]);

  useEffect(() => {
    onDrawingClickRef.current = onDrawingClick;
  }, [onDrawingClick]);

  useEffect(() => {
    magnetEnabledRef.current = magnetEnabled;
  }, [magnetEnabled]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Live-update crosshair mode when magnet toggles (without recreating chart)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      crosshair: {
        mode: magnetEnabled ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal,
      },
    });
  }, [magnetEnabled]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleClose = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
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
    const defaultAppearance = isLight ? DEFAULT_LIGHT_APPEARANCE : DEFAULT_DARK_APPEARANCE;
    const app = appearance || defaultAppearance;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: app.backgroundColor },
        textColor: isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.35)",
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: app.gridColor },
        horzLines: { color: app.gridColor },
      },
      crosshair: {
        mode: magnetEnabled ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal,
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
        rightOffset: 30,
        minBarSpacing: 3,
        tickMarkFormatter: (time: UTCTimestamp, tickMarkType: TickMarkType) => {
          const d = new Date(time * 1000);
          const isDailyOrHigher = interval && ["1d", "1wk", "1mo"].includes(interval);

          // Year-level ticks → just show the year
          if (tickMarkType === TickMarkType.Year) {
            return d.getFullYear().toString();
          }

          // Month-level ticks → just the month name (Jan, Feb, etc.)
          if (tickMarkType === TickMarkType.Month) {
            return d.toLocaleDateString("en-US", { month: "short" });
          }

          // Day-level ticks on daily+ charts → show day number only
          if (isDailyOrHigher) {
            return d.getDate().toString();
          }

          // Intraday: midnight boundary → show month + day
          const h = d.getHours();
          const m = d.getMinutes();
          if (h === 0 && m === 0) {
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }

          // Intraday time
          return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        },
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => {
          const d = new Date(time * 1000);
          const isDailyOrHigher = interval && ["1d", "1wk", "1mo"].includes(interval);
          if (isDailyOrHigher) {
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          }
          return d.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", hour12: true,
          });
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: app.upColor,
      downColor: app.downColor,
      borderUpColor: app.borderUpColor,
      borderDownColor: app.borderDownColor,
      wickUpColor: app.upWickColor,
      wickDownColor: app.downWickColor,
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

    // Click handler for select-bar mode and drawing tools
    chart.subscribeClick((param) => {
      if (!param.time) return;
      const clickedTime = param.time as number;
      const candleData = param.seriesData?.get(candleSeries);
      if (candleData && "close" in candleData) {
        // Drawing tool click
        if (onDrawingClickRef.current) {
          let price: number | null;
          if (magnetEnabledRef.current && "open" in candleData) {
            // Magnet ON: snap to nearest OHLC value of the clicked candle
            const cursorY = param.sourceEvent
              ? param.sourceEvent.clientY - chart.chartElement().getBoundingClientRect().top
              : null;
            if (cursorY !== null) {
              const ohlc = [
                (candleData as { open: number }).open,
                (candleData as { high: number }).high,
                (candleData as { low: number }).low,
                (candleData as { close: number }).close,
              ];
              // Find the OHLC value whose pixel Y is closest to cursor
              let bestPrice = candleData.close as number;
              let bestDist = Infinity;
              for (const p of ohlc) {
                const py = candleSeries.priceToCoordinate(p);
                if (py !== null) {
                  const dist = Math.abs(py - cursorY);
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestPrice = p;
                  }
                }
              }
              price = bestPrice;
            } else {
              price = candleData.close as number;
            }
          } else {
            // Magnet OFF: free-form price from exact cursor position
            price = param.sourceEvent
              ? candleSeries.coordinateToPrice(
                  param.sourceEvent.clientY -
                    chart.chartElement().getBoundingClientRect().top
                )
              : candleData.close as number;
          }
          onDrawingClickRef.current(clickedTime, price ?? (candleData.close as number));
          return; // Don't also trigger bar selection
        }
        // Bar selection click (only fires when no drawing tool is active)
        if (onChartClickRef.current) {
          const idx = candlesRef.current.findIndex(c => c.time === clickedTime);
          if (idx >= 0) {
            onChartClickRef.current(idx, candleData.close);
          }
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

    // ─── Draggable SL/TP price lines ───
    const DRAG_PROXIMITY_PX = 8;

    const handleDragMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left-click only
      if (!candleSeries || draggableLinesRef.current.length === 0) return;

      const rect = chartEl.getBoundingClientRect();
      const localY = e.clientY - rect.top;

      // Find the closest draggable line within DRAG_PROXIMITY_PX
      let closest: { info: (typeof draggableLinesRef.current)[0]; dist: number } | null = null;
      for (const info of draggableLinesRef.current) {
        const opts = info.priceLine.options();
        const lineY = candleSeries.priceToCoordinate(opts.price);
        if (lineY === null) continue;
        const dist = Math.abs(lineY - localY);
        if (dist <= DRAG_PROXIMITY_PX && (!closest || dist < closest.dist)) {
          closest = { info, dist };
        }
      }

      if (!closest) return;

      // Start dragging — prevent chart pan
      e.preventDefault();
      e.stopPropagation();
      dragStateRef.current = {
        active: true,
        lineInfo: closest.info,
        startY: localY,
        startPrice: closest.info.priceLine.options().price,
      };
      chartEl.style.cursor = "ns-resize";
      // Disable chart scrolling while dragging
      chart.applyOptions({ handleScroll: false, handleScale: false });
    };

    const handleDragMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;

      if (ds.active && ds.lineInfo) {
        // Actively dragging — update the line position
        const rect = chartEl.getBoundingClientRect();
        const localY = e.clientY - rect.top;
        const newPrice = candleSeries.coordinateToPrice(localY);
        if (newPrice !== null && newPrice > 0) {
          const label = ds.lineInfo.lineType === "sl" ? "SL" : "TP";
          ds.lineInfo.priceLine.applyOptions({
            price: newPrice,
            title: `⠿ ${label} ${newPrice.toFixed(2)}`,
          });
        }
        return;
      }

      // Not dragging — show grab cursor when hovering near a draggable line
      if (draggableLinesRef.current.length === 0) return;
      const rect = chartEl.getBoundingClientRect();
      const localY = e.clientY - rect.top;
      let nearLine = false;
      for (const info of draggableLinesRef.current) {
        const opts = info.priceLine.options();
        const lineY = candleSeries.priceToCoordinate(opts.price);
        if (lineY !== null && Math.abs(lineY - localY) <= DRAG_PROXIMITY_PX) {
          nearLine = true;
          break;
        }
      }
      chartEl.style.cursor = nearLine ? "ns-resize" : "";
    };

    const handleDragMouseUp = () => {
      const ds = dragStateRef.current;
      if (!ds.active || !ds.lineInfo) return;

      const finalPrice = ds.lineInfo.priceLine.options().price;
      const lineType = ds.lineInfo.lineType;
      const positionId = ds.lineInfo.positionId;

      // Reset drag state
      dragStateRef.current = { active: false, lineInfo: null, startY: 0, startPrice: 0 };
      chartEl.style.cursor = "";
      chart.applyOptions({ handleScroll: true, handleScale: true });

      // Only fire callback if price actually changed
      if (Math.abs(finalPrice - ds.startPrice) > 0.001) {
        if (onModifyPositionRef.current) {
          const updates = lineType === "sl"
            ? { stopLoss: finalPrice }
            : { takeProfit: finalPrice };
          onModifyPositionRef.current(positionId, updates);
        }
      }
    };

    // Use capture phase for mousedown to intercept before chart's own pan handler
    chartEl.addEventListener("mousedown", handleDragMouseDown, true);
    chartEl.addEventListener("mousemove", handleDragMouseMove);
    window.addEventListener("mouseup", handleDragMouseUp);

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Expose chart/series refs to parent for DrawingOverlay
    onChartReady?.(chart, candleSeries);

    let disposed = false;

    const handleResize = () => {
      if (disposed) return;
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
      disposed = true;
      // Disconnect observers first to stop triggering repaints
      resizeObserver.disconnect();
      chartEl.removeEventListener("contextmenu", handleContextMenu);
      chartEl.removeEventListener("mousedown", handleDragMouseDown, true);
      chartEl.removeEventListener("mousemove", handleDragMouseMove);
      window.removeEventListener("mouseup", handleDragMouseUp);
      dragStateRef.current = { active: false, lineInfo: null, startY: 0, startPrice: 0 };
      draggableLinesRef.current = [];
      // Remove chart synchronously (must happen before new chart is created)
      // Note: lightweight-charts may have pending rAF paints that fire after
      // this and throw "Object is disposed" — suppressed at module level above.
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      alertPriceLinesRef.current = [];
      indicatorSeriesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, interval]);

  // Apply appearance changes live (without re-creating the chart)
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const isLight = theme === "light";
    const defaultAppearance = isLight ? DEFAULT_LIGHT_APPEARANCE : DEFAULT_DARK_APPEARANCE;
    const app = appearance || defaultAppearance;

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: app.backgroundColor },
      },
      grid: {
        vertLines: { color: app.gridColor },
        horzLines: { color: app.gridColor },
      },
    });

    series.applyOptions({
      upColor: app.upColor,
      downColor: app.downColor,
      borderUpColor: app.borderUpColor,
      borderDownColor: app.borderDownColor,
      wickUpColor: app.upWickColor,
      wickDownColor: app.downWickColor,
    });
  }, [appearance, theme]);

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

  // ─── Position price lines (entry, SL, TP) — SL/TP are draggable ───
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;

    // Remove old price lines
    for (const line of priceLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* already removed */ }
    }
    priceLinesRef.current = [];
    draggableLinesRef.current = [];

    if (!positions || positions.length === 0) return;

    const isLight = theme === "light";
    const canDrag = !!onModifyPositionRef.current;

    for (const pos of positions) {
      // Entry price line (not draggable)
      const entryColor = pos.side === "long"
        ? (isLight ? "#26a65b" : "#22c55e")
        : (isLight ? "#dc2626" : "#ef4444");

      const pnlText = pos.unrealizedPnl >= 0
        ? `+$${pos.unrealizedPnl.toFixed(2)}`
        : `-$${Math.abs(pos.unrealizedPnl).toFixed(2)}`;

      const entryLine = series.createPriceLine({
        price: pos.entryPrice,
        color: entryColor + "66",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${pos.side === "long" ? "LONG" : "SHORT"} @ ${pos.entryPrice.toFixed(2)}  ${pnlText}`,
        axisLabelColor: entryColor + "cc",
        axisLabelTextColor: "rgba(255,255,255,0.85)",
      });
      priceLinesRef.current.push(entryLine);

      // Stop Loss line (draggable)
      if (pos.stopLoss !== null) {
        const slLine = series.createPriceLine({
          price: pos.stopLoss,
          color: isLight ? "rgba(220,38,38,0.5)" : "rgba(239,68,68,0.5)",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: canDrag ? `⠿ SL ${pos.stopLoss.toFixed(2)}` : `SL ${pos.stopLoss.toFixed(2)}`,
          axisLabelColor: isLight ? "rgba(220,38,38,0.8)" : "rgba(239,68,68,0.8)",
          axisLabelTextColor: "rgba(255,255,255,0.9)",
        });
        priceLinesRef.current.push(slLine);
        if (canDrag) {
          draggableLinesRef.current.push({ positionId: pos.id, lineType: "sl", priceLine: slLine });
        }
      }

      // Take Profit line (draggable)
      if (pos.takeProfit !== null) {
        const tpLine = series.createPriceLine({
          price: pos.takeProfit,
          color: isLight ? "rgba(22,163,74,0.5)" : "rgba(34,197,94,0.5)",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: canDrag ? `⠿ TP ${pos.takeProfit.toFixed(2)}` : `TP ${pos.takeProfit.toFixed(2)}`,
          axisLabelColor: isLight ? "rgba(22,163,74,0.8)" : "rgba(34,197,94,0.8)",
          axisLabelTextColor: "rgba(255,255,255,0.9)",
        });
        priceLinesRef.current.push(tpLine);
        if (canDrag) {
          draggableLinesRef.current.push({ positionId: pos.id, lineType: "tp", priceLine: tpLine });
        }
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

  // ─── Indicator overlay lines ───
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    // Bail if chart is disposed (can happen during interval/theme transitions)
    try { chart.chartElement(); } catch { return; }

    // Remove old indicator series
    for (const s of indicatorSeriesRef.current) {
      try { chart.removeSeries(s); } catch { /* already removed */ }
    }
    indicatorSeriesRef.current = [];

    if (!indicators || indicators.length === 0) return;

    for (const ind of indicators) {
      for (const line of ind.lines) {
        if (line.data.length === 0) continue;
        try {
        const isHistogram = ind.type === "macd" && line.key === "histogram";

        if (isHistogram) {
          const histSeries = chart.addSeries(HistogramSeries, {
            color: line.color,
            priceScaleId: ind.id,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
            lastValueVisible: false,
            priceLineVisible: false,
          });
          chart.priceScale(ind.id).applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 },
            autoScale: true,
          });
          histSeries.setData(
            line.data.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
              color: d.value >= 0 ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
            }))
          );
          indicatorSeriesRef.current.push(histSeries as unknown as ISeriesApi<"Line">);
        } else {
          const lineSeries = chart.addSeries(LineSeries, {
            color: line.color,
            lineWidth: line.key === "upper" || line.key === "lower" ? 1 : 2,
            lineStyle: line.key === "upper" || line.key === "lower" ? LineStyle.Dashed : LineStyle.Solid,
            priceScaleId: ind.overlay ? "right" : ind.id,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });

          if (!ind.overlay) {
            chart.priceScale(ind.id).applyOptions({
              scaleMargins: { top: 0.82, bottom: 0 },
              autoScale: true,
            });
          }

          lineSeries.setData(
            line.data.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            }))
          );
          indicatorSeriesRef.current.push(lineSeries);
        }
        } catch { /* chart disposed mid-loop */ }
      }
    }
  }, [indicators]);

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

  // ─── Scissors drag handlers ───
  const handleScissorsDragMove = useCallback((clientX: number) => {
    if (!chartRef.current || !containerRef.current || !onChartClickRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    try {
      const logicalIndex = chartRef.current.timeScale().coordinateToLogical(localX);
      if (logicalIndex === null) return;
      const barIndex = Math.round(logicalIndex);
      const displayCandles = visibleBars ? candles.slice(0, visibleBars) : candles;
      const clampedIndex = Math.max(0, Math.min(barIndex, displayCandles.length - 1));
      onChartClickRef.current(clampedIndex, 0);
    } catch {
      // chart may not be ready
    }
  }, [candles, visibleBars]);

  const handleScissorsMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingScissorsRef.current = true;
  }, []);

  // Global mousemove/mouseup listeners for scissors drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingScissorsRef.current) return;
      handleScissorsDragMove(e.clientX);
    };
    const handleMouseUp = () => {
      isDraggingScissorsRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleScissorsDragMove]);

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

      {/* Indicator legend (double-click to edit) */}
      {indicatorConfigs.length > 0 && (
        <div
          className="absolute top-2 right-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[40%] justify-end"
          style={{ pointerEvents: "auto" }}
        >
          {indicatorConfigs.filter((c) => c.visible).map((config) => {
            const def = INDICATOR_DEFS.find((d) => d.type === config.type);
            if (!def) return null;
            return (
              <div
                key={config.id}
                onDoubleClick={() => onEditIndicator?.(config)}
                title="Double-click to edit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(107,99,88,0.3)",
                  fontSize: 9,
                  fontWeight: 600,
                  color: isLightMode ? "rgba(0,0,0,0.6)" : "rgba(236,227,213,0.7)",
                  fontFamily: "var(--font-mono)",
                  cursor: onEditIndicator ? "pointer" : "default",
                }}
              >
                {def.shortName}({Object.values(config.params).join(",") || "-"})
              </div>
            );
          })}
        </div>
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

      {/* Semi-transparent future region overlay (right of scissors line) */}
      {replayLineX !== null && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: replayLineX,
            right: 0,
            bottom: 0,
            background: "rgba(59,130,246,0.05)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

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

          {/* Draggable hit area (visible only in selectbar mode) */}
          {activeTool === "selectbar" && (
            <div
              onMouseDown={handleScissorsMouseDown}
              style={{
                position: "absolute",
                top: 0,
                left: -8,
                width: 16,
                height: "100%",
                cursor: "col-resize",
                pointerEvents: "auto",
                zIndex: 25,
                // Debug: uncomment to see the hit area
                // background: "rgba(255,0,0,0.1)",
              }}
            />
          )}
        </div>
      )}

      {/* ─── Buy/Sell Buttons (TradingView-style, fixed top-left) ─── */}
      {showBuySellButtons && currentPrice > 0 && onBuyMarket && onSellMarket && (
        <div
          className="absolute z-10 pointer-events-auto flex items-center gap-0"
          style={{ top: 28, left: 12 }}
        >
          {/* Sell button */}
          <button
            onClick={() => onSellMarket(currentPrice - spread / 2)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: isLightMode ? "#dc2626" : "#ef4444",
              color: "white",
              border: "none",
              cursor: "pointer",
              padding: "3px 10px",
              borderRadius: "4px 0 0 4px",
              lineHeight: 1,
              minWidth: 72,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", tabularNums: true } as React.CSSProperties}>
              {(currentPrice - spread / 2).toFixed(1)}
            </span>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.85, marginTop: 1 }}>
              SELL
            </span>
          </button>

          {/* Spread */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              height: 32,
              background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: isLightMode ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.35)",
              fontWeight: 500,
              minWidth: 24,
            }}
          >
            {spread.toFixed(1)}
          </div>

          {/* Buy button */}
          <button
            onClick={() => onBuyMarket(currentPrice + spread / 2)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: isLightMode ? "#2563eb" : "#3b82f6",
              color: "white",
              border: "none",
              cursor: "pointer",
              padding: "3px 10px",
              borderRadius: "0 4px 4px 0",
              lineHeight: 1,
              minWidth: 72,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", tabularNums: true } as React.CSSProperties}>
              {(currentPrice + spread / 2).toFixed(1)}
            </span>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.85, marginTop: 1 }}>
              BUY
            </span>
          </button>

          {/* Info icon */}
          <div
            style={{
              marginLeft: 4,
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `1px solid ${isLightMode ? "rgba(0,0,0,0.15)" : "rgba(236,227,213,0.15)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              color: isLightMode ? "rgba(0,0,0,0.3)" : "rgba(236,227,213,0.3)",
              cursor: "help",
            }}
            title="Paper trading — simulated orders only"
          >
            i
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
                background: isLong
                  ? (isLightMode ? "rgba(34,197,94,0.12)" : "rgba(20,30,22,0.95)")
                  : (isLightMode ? "rgba(239,68,68,0.12)" : "rgba(35,20,20,0.95)"),
                color: isLong ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
                border: `1px solid ${isLong ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                backdropFilter: "blur(4px)",
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
              left: Math.min(contextMenu.x, window.innerWidth - 240),
              top: Math.min(contextMenu.y, window.innerHeight - 100),
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
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto" as const,
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

              {/* Market orders at right-click price */}
              {onBuyMarket && (
                <ContextMenuItem
                  icon={<span style={{ color: "#22c55e", fontWeight: 700, fontSize: 10 }}>M▲</span>}
                  label="Buy Market"
                  onClick={() => { onBuyMarket(contextMenu.price); setContextMenu(prev => ({ ...prev, visible: false })); }}
                  isLight={isLightMode}
                  accentColor="#22c55e"
                />
              )}
              {onSellMarket && (
                <ContextMenuItem
                  icon={<span style={{ color: "#ef4444", fontWeight: 700, fontSize: 10 }}>M▼</span>}
                  label="Sell Market"
                  onClick={() => { onSellMarket(contextMenu.price); setContextMenu(prev => ({ ...prev, visible: false })); }}
                  isLight={isLightMode}
                  accentColor="#ef4444"
                />
              )}

              {(onBuyLimit || onSellLimit || onBuyMarket || onSellMarket) && (
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

              <ContextMenuItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? "#666" : "rgba(236,227,213,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                }
                label="Fit All Data"
                onClick={() => {
                  if (chartRef.current) {
                    chartRef.current.timeScale().fitContent();
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
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

              {/* ─── Chart Settings ─── */}
              <div style={{ height: 1, background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)", margin: "2px 0" }} />
              <ContextMenuItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? "#666" : "rgba(236,227,213,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                }
                label="Chart Settings..."
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  setShowSettingsModal(true);
                }}
                isLight={isLightMode}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Chart Settings Modal ─── */}
      <AnimatePresence>
        {showSettingsModal && (
          <ChartSettingsModal
            isLight={isLightMode}
            appearance={appearance || (isLightMode ? DEFAULT_LIGHT_APPEARANCE : DEFAULT_DARK_APPEARANCE)}
            onAppearanceChange={(app) => onAppearanceChange?.(app)}
            symbol={symbol}
            interval={interval}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "300px", cursor: chartCursor }}
      />

      {/* Drawing overlay slot (rendered by parent) */}
      {children}
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

// ─── Settings Tab IDs ───
type SettingsTab = "symbol" | "canvas" | "scales" | "trading";

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "symbol",
    label: "Symbol",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "canvas",
    label: "Canvas",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: "scales",
    label: "Scales & Lines",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "trading",
    label: "Trading",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

// ─── Chart Settings Modal (TradingView-style) ───
function ChartSettingsModal({
  isLight,
  appearance,
  onAppearanceChange,
  symbol,
  interval,
  onClose,
}: {
  isLight: boolean;
  appearance: ChartAppearance;
  onAppearanceChange: (app: ChartAppearance) => void;
  symbol?: string;
  interval?: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("symbol");
  const [localAppearance, setLocalAppearance] = useState<ChartAppearance>(appearance);

  const update = (key: keyof ChartAppearance, value: string) => {
    setLocalAppearance(prev => ({ ...prev, [key]: value }));
  };

  const handleOk = () => {
    onAppearanceChange(localAppearance);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const bg = isLight ? "#ffffff" : "#1e1e22";
  const sidebarBg = isLight ? "#f5f5f5" : "#18181c";
  const border = isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.1)";
  const textPrimary = isLight ? "#333" : "rgba(236,227,213,0.9)";
  const textSecondary = isLight ? "rgba(0,0,0,0.5)" : "rgba(236,227,213,0.5)";
  const sectionLabel = isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.4)";
  const hoverBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(236,227,213,0.06)";
  const activeBg = isLight ? "rgba(42,130,228,0.1)" : "rgba(196,123,58,0.15)";
  const activeColor = isLight ? "#2a82e4" : "#c47b3a";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={handleCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 680,
          maxWidth: "90vw",
          maxHeight: "80vh",
          background: bg,
          borderRadius: 12,
          border: `1px solid ${border}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, letterSpacing: "-0.01em" }}>Settings</span>
          <button
            onClick={handleCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: textSecondary,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{
            width: 180,
            flexShrink: 0,
            background: sidebarBg,
            borderRight: `1px solid ${border}`,
            padding: "8px 0",
            overflowY: "auto",
          }}>
            {SETTINGS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 16px",
                  background: activeTab === tab.id ? activeBg : "transparent",
                  border: "none",
                  borderLeft: activeTab === tab.id ? `3px solid ${activeColor}` : "3px solid transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? activeColor : textSecondary,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: "all 100ms ease",
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = hoverBg;
                }}
                onMouseLeave={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ flexShrink: 0, opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {/* ─── Symbol Tab ─── */}
            {activeTab === "symbol" && (
              <div>
                <SectionHeading label="SYMBOL" color={sectionLabel} />
                <SettingsRow label="Symbol" isLight={isLight}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: "var(--font-mono)" }}>
                    {symbol || "NQ=F"}
                  </span>
                </SettingsRow>
                <SettingsRow label="Interval" isLight={isLight}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: textPrimary, fontFamily: "var(--font-mono)" }}>
                    {interval || "1d"}
                  </span>
                </SettingsRow>

                <SectionHeading label="DATA" color={sectionLabel} />
                <SettingsRow label="Precision" isLight={isLight}>
                  <span style={{ fontSize: 12, color: textSecondary }}>Default</span>
                </SettingsRow>
                <SettingsRow label="Timezone" isLight={isLight}>
                  <span style={{ fontSize: 12, color: textSecondary }}>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </SettingsRow>
              </div>
            )}

            {/* ─── Canvas Tab ─── */}
            {activeTab === "canvas" && (
              <div>
                <SectionHeading label="CANVAS" color={sectionLabel} />
                <SettingsColorRow label="Background" value={localAppearance.backgroundColor} onChange={c => update("backgroundColor", c)} isLight={isLight} />
                <SettingsColorRow label="Grid Lines" value={localAppearance.gridColor} onChange={c => update("gridColor", c)} isLight={isLight} />

                <SectionHeading label="BULLISH CANDLE" color={sectionLabel} />
                <SettingsColorRow label="Body" value={localAppearance.upColor} onChange={c => update("upColor", c)} isLight={isLight} />
                <SettingsColorRow label="Border" value={localAppearance.borderUpColor} onChange={c => update("borderUpColor", c)} isLight={isLight} />
                <SettingsColorRow label="Wick" value={localAppearance.upWickColor} onChange={c => update("upWickColor", c)} isLight={isLight} />

                <SectionHeading label="BEARISH CANDLE" color={sectionLabel} />
                <SettingsColorRow label="Body" value={localAppearance.downColor} onChange={c => update("downColor", c)} isLight={isLight} />
                <SettingsColorRow label="Border" value={localAppearance.borderDownColor} onChange={c => update("borderDownColor", c)} isLight={isLight} />
                <SettingsColorRow label="Wick" value={localAppearance.downWickColor} onChange={c => update("downWickColor", c)} isLight={isLight} />

                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={() => setLocalAppearance(isLight ? DEFAULT_LIGHT_APPEARANCE : DEFAULT_DARK_APPEARANCE)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: textSecondary,
                      background: hoverBg,
                      border: `1px solid ${border}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "'Inter', system-ui, sans-serif",
                    }}
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            )}

            {/* ─── Scales & Lines Tab ─── */}
            {activeTab === "scales" && (
              <div>
                <SectionHeading label="PRICE SCALE" color={sectionLabel} />
                <SettingsRow label="Scale position" isLight={isLight}>
                  <span style={{ fontSize: 12, color: textSecondary }}>Right</span>
                </SettingsRow>
                <SettingsRow label="Auto scale" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>

                <SectionHeading label="CROSSHAIR" color={sectionLabel} />
                <SettingsRow label="Show crosshair" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>
                <SettingsRow label="Crosshair labels" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>

                <SectionHeading label="STATUS LINE" color={sectionLabel} />
                <SettingsRow label="Show OHLCV" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>
              </div>
            )}

            {/* ─── Trading Tab ─── */}
            {activeTab === "trading" && (
              <div>
                <SectionHeading label="ORDER ENTRY" color={sectionLabel} />
                <SettingsRow label="Show trade widget" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>
                <SettingsRow label="Show positions on chart" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>

                <SectionHeading label="DISPLAY" color={sectionLabel} />
                <SettingsRow label="Position labels" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>
                <SettingsRow label="Trade markers" isLight={isLight}>
                  <SettingsToggle checked={true} isLight={isLight} onChange={() => {}} />
                </SettingsRow>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 20px",
          borderTop: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: "7px 20px",
              fontSize: 13,
              fontWeight: 500,
              color: textSecondary,
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={handleOk}
            style={{
              padding: "7px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: activeColor,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Ok
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Settings Modal Sub-Components ───

function SectionHeading({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color,
      padding: "14px 0 6px",
    }}>
      {label}
    </div>
  );
}

function SettingsRow({ label, isLight, children }: { label: string; isLight: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: `1px solid ${isLight ? "rgba(0,0,0,0.04)" : "rgba(236,227,213,0.04)"}`,
    }}>
      <span style={{
        fontSize: 13,
        color: isLight ? "rgba(0,0,0,0.7)" : "rgba(236,227,213,0.7)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function SettingsColorRow({ label, value, onChange, isLight }: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  isLight: boolean;
}) {
  // Parse rgba values to extract hex color and alpha separately
  let displayHex: string;
  let alpha: number | null = null;

  if (value.startsWith("rgba")) {
    const match = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      displayHex = `#${r}${g}${b}`;
      alpha = parseFloat(match[4]);
    } else {
      displayHex = isLight ? "#ffffff" : "#1a1714";
    }
  } else if (value === "transparent") {
    displayHex = isLight ? "#ffffff" : "#1a1714";
  } else {
    displayHex = value;
  }

  const handleColorChange = (newHex: string) => {
    if (alpha !== null) {
      // Preserve original alpha (e.g., grid lines stay subtle)
      const r = parseInt(newHex.slice(1, 3), 16);
      const g = parseInt(newHex.slice(3, 5), 16);
      const b = parseInt(newHex.slice(5, 7), 16);
      onChange(`rgba(${r},${g},${b},${alpha})`);
    } else {
      onChange(newHex);
    }
  };

  return (
    <SettingsRow label={label} isLight={isLight}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${isLight ? "rgba(0,0,0,0.15)" : "rgba(236,227,213,0.15)"}`,
            background: displayHex,
            position: "relative",
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <input
            type="color"
            value={displayHex}
            onChange={e => handleColorChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        </div>
        <span style={{
          fontSize: 10,
          fontFamily: "var(--font-mono), monospace",
          color: isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.4)",
          minWidth: 58,
          textTransform: "uppercase",
        }}>
          {displayHex}
        </span>
      </div>
    </SettingsRow>
  );
}

function SettingsToggle({ checked, isLight, onChange }: { checked: boolean; isLight: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked
          ? (isLight ? "#2a82e4" : "#c47b3a")
          : (isLight ? "rgba(0,0,0,0.15)" : "rgba(236,227,213,0.15)"),
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 150ms ease",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        background: "#fff",
        position: "absolute",
        top: 2,
        left: checked ? 18 : 2,
        transition: "left 150ms ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}
