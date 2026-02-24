// OHLCV candle data
export interface Candle {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Futures contract config
export interface ContractConfig {
  symbol: string;
  name: string;
  pointValue: number;
  tickSize: number;
}

export const CONTRACTS: Record<string, ContractConfig> = {
  "NQ=F": { symbol: "NQ=F", name: "NQ (Nasdaq 100)", pointValue: 20, tickSize: 0.25 },
  "MNQ=F": { symbol: "MNQ=F", name: "MNQ (Micro Nasdaq)", pointValue: 2, tickSize: 0.25 },
  "ES=F": { symbol: "ES=F", name: "ES (S&P 500)", pointValue: 50, tickSize: 0.25 },
  "GC=F": { symbol: "GC=F", name: "GC (Gold)", pointValue: 100, tickSize: 0.10 },
  "CL=F": { symbol: "CL=F", name: "CL (Crude Oil)", pointValue: 1000, tickSize: 0.01 },
};

/** Returns the contract config for known futures, or a stock-like default (1 share = 1 unit) */
export function getContractConfig(symbol: string): ContractConfig {
  return CONTRACTS[symbol] ?? { symbol, name: symbol, pointValue: 1, tickSize: 0.01 };
}

// Trade record from backtest
export interface Trade {
  id: number;
  instrument: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  pnlPoints: number;
  commission: number;
}

// Backtest result metrics
export interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  profitFactor: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  // Advanced metrics
  sortinoRatio?: number;
  calmarRatio?: number;
  recoveryFactor?: number;
  expectancy?: number;
  expectancyRatio?: number;
  payoffRatio?: number;
  // Deflated Sharpe Ratio (Bailey & Lopez de Prado, 2014)
  deflatedSharpeRatio?: number;
  dsrPvalue?: number;
}

// Parameter sweep result from VectorBT
export interface ParameterSweepResult {
  totalCombos: number;
  paramNames: string[];
  bestParams: Record<string, number>;
  bestMetrics: BacktestMetrics;
  heatmapData: HeatmapData | null;
  allResults: Record<string, unknown>[];
}

// Heatmap data for 2-param sweeps
export interface HeatmapData {
  xParam: string;
  yParam: string;
  xValues: number[];
  yValues: number[];
  metric: string;
  cells: {
    x: number;
    y: number;
    value: number;
    metrics: Record<string, number>;
  }[];
}

// Monte Carlo simulation result
export interface MonteCarloResult {
  numSimulations: number;
  numTrades: number;
  meanReturn: number;
  medianReturn: number;
  stdReturn: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  meanMaxDrawdown: number;
  medianMaxDrawdown: number;
  worstMaxDrawdown: number;
  percentile95Drawdown: number;
  probabilityOfRuin: number;
  probabilityOfProfit: number;
  equityPercentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  // Multi-method Monte Carlo (Phase 2)
  method?: "reshuffle" | "resample" | "skip" | "full";
  robustnessScore?: number;     // 0-100 composite score
  robustnessGrade?: string;     // A+ through F
  subResults?: {
    reshuffle?: MonteCarloResult;
    resample?: MonteCarloResult;
    skip?: MonteCarloResult;
  };
}

// Walk-forward analysis result
export interface WalkForwardResult {
  numWindows: number;
  isRatio: number;
  windows: {
    windowIndex: number;
    isStart: string;
    isEnd: string;
    oosStart: string;
    oosEnd: string;
    isBars: number;
    oosBars: number;
    isMetrics: Record<string, number>;
    oosMetrics: Record<string, number>;
    bestParams: Record<string, number>;
  }[];
  aggregateOosMetrics: Record<string, number>;
  oosTrades: Trade[];
  oosEquityCurve: { time: number; value: number }[];
  robustnessRatio: number;
  // Stability metrics (Phase 2D)
  paramStability?: {
    coefficientOfVariation: Record<string, number>;
    recommendation: "PASS" | "CAUTION" | "FAIL";
    reasons: string[];
  };
}

// Trade pattern analysis result
export interface TradeAnalysisResult {
  totalTradesAnalyzed: number;
  bestEntryHours: { hour: number; avgPnl: number; tradeCount: number; winRate: number }[];
  bestEntryDays: { dayName: string; avgPnl: number; tradeCount: number; winRate: number }[];
  tradeScores: { tradeId: number; score: number; factors: Record<string, number>; pnl: number }[];
  avgScoreWinners: number;
  avgScoreLosers: number;
  avgAtrBeforeWinners: number;
  avgAtrBeforeLosers: number;
  momentumBeforeWinners: number;
  momentumBeforeLosers: number;
  avgMaeWinners: number;
  avgMaeLosers: number;
  avgMfeWinners: number;
  avgMfeLosers: number;
  avgContinuationAfterWin: number;
  avgContinuationAfterLoss: number;
}

// Full backtest result
export interface BacktestResult {
  trades: Trade[];
  equityCurve: { time: number; value: number }[];
  metrics: BacktestMetrics;
  strategyName: string;
  strategyDescription: string;
}

// Strategy generated by AI
export interface GeneratedStrategy {
  code: string;
  name: string;
  description: string;
  parameters: Record<string, number | string>;
}

// PineScript result from AI generation
export interface PineScriptResult {
  name: string;
  description: string;
  parameters: Record<string, string>;
  code: string;
  script_type: "strategy" | "indicator";
}

// Chat message
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  strategyResult?: BacktestResult;
  pinescriptResult?: PineScriptResult;
  monteCarloResult?: MonteCarloResult;
  walkForwardResult?: WalkForwardResult;
  tradeAnalysisResult?: TradeAnalysisResult;
  chartScriptResult?: import("./chart-scripts").ChartScript;
  // NOTE: Added for Agent SDK SSE streaming — true while tokens are arriving
  isStreaming?: boolean;
}

// Tick data from Databento
export interface Tick {
  time: number; // Unix timestamp (seconds, float)
  price: number;
  size: number;
  side: string;
}

// Replay state
export interface ReplayState {
  isPlaying: boolean;
  currentBarIndex: number;
  totalBars: number;
  speed: number;
  progress: number;
  tickMode: boolean; // true = tick-by-tick replay within bars
  currentTickIndex: number;
  totalTicks: number;
}

// API request/response types
export interface ChatRequest {
  message: string;
  symbol: string;
  timeframe: string;
  conversationHistory: { role: string; content: string }[];
}

export interface ChatResponse {
  message: string;
  strategy?: GeneratedStrategy;
  backtestResult?: BacktestResult;
  pinescript?: PineScriptResult;
  monteCarlo?: MonteCarloResult;
  walkForward?: WalkForwardResult;
  tradeAnalysis?: TradeAnalysisResult;
  chartScript?: import("./chart-scripts").ChartScript;
}

export interface DataRequest {
  symbol: string;
  period: string;
  interval: string;
}

// ─── Simulated Trading Engine Types ───

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  entryTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  unrealizedPnl: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  type: "market" | "limit" | "stop";
  price: number | null;
  status: "pending" | "filled" | "cancelled";
  createdAt: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  pnlPoints: number;
  commission: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  positions: Position[];
  orders: Order[];
  tradeHistory: ClosedTrade[];
}

export interface RiskSettings {
  maxOpenPositions: number | null;
  allowedSymbols: string[];
  requireSlTp: boolean;
  maxLossPerTradePct: number | null;
  presetSlPct: number | null;
  presetTpPct: number | null;
}

export type AppTheme = "dark-amber" | "midnight-blue" | "forest-green" | "classic-light" | "obsidian";
export type AppCurrency = "KES" | "USD" | "GBP" | "EUR";
export type AppBroker = "egm" | "dyer-blair" | "faida" | "genghis" | "sbg" | "standard-inv" | "aib-axys" | "none";
export type FundingMethod = "mpesa" | "airtel-money" | "tkash" | "kcb-mpesa" | "equity-eazzy" | "bank-rtgs" | "visa-mc" | "none";

export interface AppSettings {
  // Appearance
  theme: AppTheme;

  // Broker & Connection
  broker: AppBroker;
  brokerAccountId: string;
  fundingMethod: FundingMethod;

  // Account
  currency: AppCurrency;
  language: string;
  marketRegion: string;

  // Trading
  oneClickTrading: boolean;
  tradeExecutionSound: boolean;
  showBuySellButtons: boolean;
  showPositionsOnChart: boolean;
  reversePositionButton: boolean;
  showPnlOnChart: boolean;
  defaultOrderType: "market" | "limit";
  defaultLotSize: number;

  // Notifications
  showNotifications: boolean;
  notificationDuration: number;
  pushNotifications: boolean;
  smsAlerts: boolean;
  smsPhone: string;

  // Display
  showTradeHistoryOnChart: boolean;
  bigLotThreshold: number;
  compactMode: boolean;
}
