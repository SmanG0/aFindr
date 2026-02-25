# aFindr iOS Mobile App - Comprehensive Implementation Plan

> **Status:** Planning | **Date:** 2026-02-24
> **Scope:** Full iOS native app replicating aFindr web platform with Apple Liquid Glass UI
> **Preservation Note:** This plan is read-only analysis. No existing code was modified.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Web App Audit Summary](#2-web-app-audit-summary)
3. [Recommended Tech Stack](#3-recommended-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Screen-by-Screen Mapping](#5-screen-by-screen-mapping)
6. [Component Migration Guide](#6-component-migration-guide)
7. [Liquid Glass Design System](#7-liquid-glass-design-system)
8. [Data Layer & Database](#8-data-layer--database)
9. [Backend Integration](#9-backend-integration)
10. [Authentication](#10-authentication)
11. [Charting Engine](#11-charting-engine)
12. [AI Copilot (Alphy)](#12-ai-copilot-alphy)
13. [Trading Engine](#13-trading-engine)
14. [Push Notifications & Alerts](#14-push-notifications--alerts)
15. [Dependencies & Packages](#15-dependencies--packages)
16. [Project Structure](#16-project-structure)
17. [Implementation Phases](#17-implementation-phases)
18. [Risk Assessment](#18-risk-assessment)
19. [Performance Targets](#19-performance-targets)
20. [App Store Considerations](#20-app-store-considerations)

---

## 1. Executive Summary

aFindr is a production-grade AI-powered trading platform currently running as a Next.js 15 web app with a Python FastAPI backend. This plan details how to build a native iOS app that replicates every feature while leveraging Apple's **Liquid Glass** design language (iOS 26+) for a premium, platform-native experience.

### What We're Building
- A **SwiftUI-native** iOS app targeting iOS 18+ (with Liquid Glass on iOS 26)
- Full feature parity with the web app's 8 pages, 30+ components, and 40+ AI tools
- Shared Python backend (FastAPI) - the mobile app consumes the same API
- Convex real-time database for cloud sync across web and mobile
- Native charting with gesture-driven interactions (pinch-zoom, pan, draw)

### Why Native (Not React Native)
| Factor | SwiftUI Native | React Native |
|--------|---------------|--------------|
| Liquid Glass support | First-class (UIKit/SwiftUI) | Delayed/limited |
| Chart performance | Metal GPU rendering | JS bridge bottleneck |
| Haptic feedback | Native APIs | Limited abstraction |
| App Store approval | Preferred | No issues but native preferred for finance |
| Drawing tools (touch) | Core Graphics/Metal | Canvas bridge overhead |
| Background tasks | URLSession, BGTaskScheduler | Limited |
| Widget support | WidgetKit native | Third-party bridges |

---

## 2. Web App Audit Summary

### Current Web Architecture
```
Frontend (Next.js 15 + React 19)
├── 8 Pages: Trade, Dashboard, Portfolio, News, Alpha Lab, Settings, Journal, Library
├── 30+ Components: Chart, Navbars, Copilot, PositionsPanel, StrategyTester, etc.
├── 9 Custom Hooks: useAgentStream, useTradingEngine, useDrawings, etc.
├── Convex BaaS: 15+ tables (users, positions, trades, holdings, alerts, etc.)
├── Auth: Google OAuth + Password via @convex-dev/auth
├── Charting: TradingView Lightweight Charts 5.1
├── Animations: Framer Motion 12.34
└── Styling: Tailwind CSS 4 + Custom glass morphism CSS

Backend (Python FastAPI)
├── AI Agent: Claude Haiku/Sonnet with 40+ tools
├── Data Fetchers: yfinance, Polygon, Finnhub, FRED, BLS, Polymarket, Kalshi
├── Engine: Backtester, VectorBT, Walk-Forward, Monte Carlo
├── RAG: ChromaDB with strategy patterns + VectorBT docs
├── Chart Patterns: ICT/SMC (FVG, Order Blocks, BOS/CHOCH), Key Levels, Divergences
└── DB: SQLite (positions, trades, backtest_runs, walk_forward_results)
```

### Feature Inventory (All Must Be Replicated)
- [ ] Interactive candlestick charting with 25+ indicators
- [ ] 14 drawing tools (trendline, fib, rectangle, channel, etc.)
- [ ] AI chat copilot with SSE streaming
- [ ] Strategy backtesting with equity curve visualization
- [ ] Monte Carlo simulation visualization
- [ ] Walk-forward analysis
- [ ] Parameter sweep heatmaps
- [ ] Paper trading engine (positions, orders, trade history)
- [ ] News feed with sentiment analysis
- [ ] Portfolio dashboard with holdings
- [ ] Stock detail view with order placement
- [ ] Symbol search with 200+ symbols across 6 categories
- [ ] Price and news alerts
- [ ] Risk management controls
- [ ] 5 theme system (dark-amber, midnight-blue, forest-green, obsidian, classic-light)
- [ ] Onboarding wizard (6 steps)
- [ ] PineScript code generation and display
- [ ] Agent control mode (Alphy controls UI)
- [ ] Historical replay with playback controls
- [ ] Trade journal
- [ ] Strategy library

---

## 3. Recommended Tech Stack

### Core Framework
| Layer | Technology | Justification |
|-------|-----------|---------------|
| **UI Framework** | SwiftUI (iOS 18+) | Native Liquid Glass, declarative UI |
| **Architecture** | MVVM + Clean Architecture | Testable, scalable, separation of concerns |
| **Navigation** | NavigationStack + TabView | Native iOS navigation patterns |
| **State Management** | @Observable (Observation framework) | Modern Swift concurrency-compatible |
| **Networking** | URLSession + async/await | Native, no dependencies |
| **Streaming** | URLSession SSE + AsyncSequence | SSE streaming for AI chat |
| **Local Storage** | SwiftData | Apple's modern persistence (replaces Core Data) |
| **Keychain** | KeychainAccess | Secure credential storage |
| **Charts** | Custom Metal/Core Graphics OR DGCharts | Performance-critical |
| **Animations** | SwiftUI animations + Core Animation | Liquid Glass transitions |
| **Auth** | Convex Swift SDK + ASAuthorizationAppleIDProvider | Apple Sign-In + existing auth |

### Supporting Libraries
| Library | Purpose | Replaces Web Equivalent |
|---------|---------|------------------------|
| **DGCharts** (or custom) | Candlestick charting | Lightweight Charts 5.1 |
| **Starscream** | WebSocket client | Native EventSource |
| **SDWebImageSwiftUI** | Async image loading | Next.js Image |
| **Convex Swift SDK** | Real-time database | convex npm package |
| **SwiftUI-Markdown** | Markdown rendering | react-markdown |
| **HighlightSwift** | Code syntax highlighting | Code blocks in chat |
| **Lottie-ios** | Complex animations | Framer Motion |
| **SwiftNIO** | SSE event parsing | EventSource polyfill |

### Build & Tooling
| Tool | Purpose |
|------|---------|
| **Xcode 16+** | IDE and build system |
| **Swift Package Manager** | Dependency management |
| **SwiftLint** | Code style enforcement |
| **Swift Testing** | Unit + integration tests |
| **XCUITest** | UI automation tests |
| **Instruments** | Performance profiling |
| **TestFlight** | Beta distribution |

---

## 4. Architecture Overview

### Clean Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Views     │  │  ViewModels  │  │   UI Components    │  │
│  │  (SwiftUI)  │  │ (@Observable)│  │  (Reusable Parts)  │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Models    │  │  Use Cases   │  │   Repositories     │  │
│  │  (Entities) │  │ (Interactors)│  │   (Protocols)      │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                       DATA LAYER                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  API Client │  │  Convex SDK  │  │   SwiftData        │  │
│  │ (FastAPI)   │  │  (Real-time) │  │   (Local Cache)    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Interaction
    ↓
SwiftUI View (@State, @Binding)
    ↓
ViewModel (@Observable, @Published)
    ↓
Use Case / Service
    ↓
┌─────────────────────────────────┐
│         Repository              │
│  ┌───────────┐  ┌───────────┐  │
│  │ Remote    │  │ Local     │  │
│  │ (FastAPI) │  │ (SwiftData│  │
│  │ (Convex)  │  │  Cache)   │  │
│  └───────────┘  └───────────┘  │
└─────────────────────────────────┘
    ↓
ViewModel updates @Published properties
    ↓
SwiftUI re-renders (automatic)
```

### Streaming Architecture (AI Chat)

```
User sends message
    ↓
ChatViewModel.sendMessage()
    ↓
AgentStreamService.stream(request)
    ↓
URLSession with delegate (SSE parsing)
    ↓
AsyncStream<AgentEvent> yields events:
  .textDelta(String)
  .toolStart(ToolEvent)
  .toolResult(ToolEvent)
  .approvalRequired(ApprovalRequest)
  .uiAction(UIAction)
  .done(AgentResponse)
    ↓
ChatViewModel updates @Published:
  - streamingText (live text)
  - toolEvents (tool status cards)
  - isStreaming (loading state)
    ↓
SwiftUI ChatView re-renders (automatic)
```

---

## 5. Screen-by-Screen Mapping

### Tab Bar Structure (Bottom Navigation)

```
┌─────────────────────────────────────────────┐
│                                             │
│           [Active Screen Content]           │
│                                             │
├─────────────────────────────────────────────┤
│  🏠       📊       📈       📰      🧪    │
│ Home    Portfolio  Trade    News    Alpha   │
└─────────────────────────────────────────────┘
```

### Screen Mapping: Web → iOS

| Web Page | iOS Screen | Navigation | Notes |
|----------|-----------|------------|-------|
| **Dashboard** | `HomeView` (Tab 1) | Tab root | Portfolio summary, watchlist, thesis, news ticker |
| **Portfolio** | `PortfolioView` (Tab 2) | Tab root → Detail push | Holdings list → Stock detail → Order sheet |
| **Trade** | `TradeView` (Tab 3) | Tab root | Chart + indicators + drawings + positions panel |
| **News** | `NewsView` (Tab 4) | Tab root → Article push | News feed → Article detail |
| **Alpha Lab** | `AlphaView` (Tab 5) | Tab root | AI research workspace |
| **Settings** | `SettingsView` | Gear icon → Sheet/Push | Multi-section settings |
| **Journal** | `JournalView` | HomeView sub-tab | Trade journal |
| **Library** | `LibraryView` | HomeView sub-tab | Strategy library |
| **Landing** | `LandingView` | Pre-auth root | Onboarding entry |
| **Onboarding** | `OnboardingView` | Post-signup flow | 6-step wizard |

### Detailed Screen Breakdowns

#### Tab 1: Home (Dashboard)
```
HomeView
├── Header: Greeting + date + weather
├── PortfolioSummaryCard (glass card)
│   ├── Total balance, equity, P&L
│   └── Sparkline mini chart
├── WatchlistSection
│   ├── Horizontal scroll of ticker cards
│   └── Each: symbol, price, change%, mini sparkline
├── ThesisSection
│   ├── Per-ticker thesis cards
│   └── Bullish/bearish/neutral tags
├── NewsTickerBanner (horizontal auto-scroll)
├── MarketSessionIndicator (NY/London/Tokyo status)
└── SubTabs: Overview | Journal | Library
```

#### Tab 2: Portfolio
```
PortfolioView
├── PortfolioHeaderCard
│   ├── Total value, day change
│   └── Allocation pie chart
├── HoldingsList (LazyVStack)
│   ├── HoldingRow: icon, name, shares, value, change%
│   └── Swipe actions: quick-trade, details
├── Push: StockDetailView
│   ├── Price chart (1D/1W/1M/3M/1Y/ALL)
│   ├── Key stats grid
│   ├── Analyst ratings
│   ├── News for ticker
│   └── Order sheet (Buy/Sell)
└── SearchBar: Symbol search
```

#### Tab 3: Trade (Main Chart)
```
TradeView
├── SymbolBar: Current symbol + timeframe pills
├── ChartView (full-width, primary content)
│   ├── Candlestick chart (pinch-zoom, pan, scroll)
│   ├── Indicator overlays (SMA, EMA, BB, VWAP, etc.)
│   ├── Drawing overlays (trendlines, fibs, etc.)
│   ├── Trade markers (entry/exit arrows)
│   ├── Position lines (stop-loss, take-profit)
│   └── Replay scrubber (timeline at bottom)
├── ToolStrip (horizontal scroll below chart)
│   ├── Drawing tools
│   ├── Indicator button
│   └── Replay controls
├── QuickTradeBar: BUY | SELL buttons + size
├── PositionsSheet (drag-up bottom sheet)
│   ├── Tabs: Positions | Orders | History | Metrics
│   └── StrategyTester sub-tabs when backtest active:
│       ├── Overview (metrics + equity curve)
│       ├── Trades (trade list)
│       ├── Monte Carlo (distribution charts)
│       ├── Walk-Forward (robustness)
│       ├── Heatmap (parameter sweep)
│       └── Run Log (agent execution log)
└── CopilotButton (floating action button → Copilot sheet)
```

#### Tab 4: News
```
NewsView
├── CategoryFilter: horizontal pills (All, Markets, Macro, Earnings, etc.)
├── NewsFeed (LazyVStack, pull-to-refresh)
│   ├── NewsCard: headline, source, time, sentiment chip, thumbnail
│   └── Ticker tags (tappable → jump to Trade)
├── Push: ArticleDetailView
│   ├── Full article content
│   ├── Related tickers
│   └── Share action
└── SearchBar: Search news
```

#### Tab 5: Alpha Lab
```
AlphaView
├── ConversationList (sidebar or sheet)
│   └── Past conversations
├── ChatView
│   ├── MessageList (LazyVStack)
│   │   ├── UserMessageBubble
│   │   ├── AssistantMessageBubble (markdown rendered)
│   │   ├── ToolExecutionCard (expanding disclosure)
│   │   ├── BacktestResultCard (inline metrics + equity chart)
│   │   ├── PineScriptCard (syntax-highlighted code)
│   │   ├── MonteCarloCard (distribution chart)
│   │   ├── OptionsChainCard (table)
│   │   └── ApprovalRequestCard (approve/deny buttons)
│   ├── StreamingIndicator (typing animation)
│   └── TokenUsageBadge
├── InputBar
│   ├── Text field with context pills (symbol, timeframe)
│   └── Send button
└── Context: auto-includes current symbol, interval, page
```

#### Settings
```
SettingsView (NavigationStack)
├── AccountSection
│   ├── Profile (name, email, avatar)
│   ├── Subscription status
│   └── Sign out
├── GeneralSection
│   ├── Default symbol
│   ├── Default timeframe
│   ├── Currency (KES, USD, GBP, EUR)
│   └── Language
├── TradingSection
│   ├── Default position size
│   ├── Commission per trade
│   ├── Slippage settings
│   └── Risk management rules
├── BrokerSection
│   ├── Broker selection (EGM, Dyer & Blair, Faida, etc.)
│   └── Funding method (M-Pesa, bank, card)
├── AppearanceSection
│   ├── Theme picker (5 themes, live preview)
│   ├── Chart style preferences
│   └── Font size
├── NotificationsSection
│   ├── Push notification toggles
│   ├── Alert sounds
│   └── Quiet hours
└── APIKeysSection
    ├── Polygon API key
    ├── Finnhub API key
    └── Other integrations
```

#### Onboarding
```
OnboardingView (PageTabView style)
├── Step 1: Welcome + Name input
├── Step 2: Experience level (Beginner/Intermediate/Advanced/Pro)
├── Step 3: Markets & trading style (Day/Swing/Position/Scalping)
├── Step 4: Analysis approach (Technical/Fundamental/Quantitative)
├── Step 5: Risk tolerance + Broker setup
└── Step 6: Theme selection (live preview) → Complete
```

---

## 6. Component Migration Guide

### Web Component → iOS Component Mapping

| Web Component | iOS Equivalent | Implementation |
|--------------|---------------|----------------|
| `Navbar1` | `TabView` + custom tab bar | Bottom tab navigation |
| `Navbar2` | `SymbolToolbar` (sticky top) | Custom toolbar view |
| `LeftSidebar` | `DrawingToolStrip` | Horizontal scroll strip or bottom sheet |
| `Chart/Chart.tsx` | `CandlestickChartView` | DGCharts or custom Metal renderer |
| `Chart/DrawingOverlay` | `ChartDrawingLayer` | Core Graphics overlay on chart |
| `Chart/ScriptOverlay` | `IndicatorOverlayView` | Chart data series overlays |
| `CopilotOverlay` | `CopilotSheet` | `.sheet` or `.fullScreenCover` presentation |
| `PositionsPanel` | `PositionsBottomSheet` | `UISheetPresentationController` / detents |
| `SymbolsSearch` | `SymbolSearchView` | `.searchable` modifier + sheet |
| `SettingsPage` | `SettingsView` | `NavigationStack` + `Form` |
| `DashboardPage` | `HomeView` | ScrollView with cards |
| `PortfolioPage` | `PortfolioView` | List → NavigationLink |
| `AlphaPlayground` | `AlphaView` | Chat interface |
| `ArtifactBlocks` | `ArtifactCardView` | Expandable disclosure groups |
| `StrategyTester/*` | `StrategyTesterView` | Tabbed sheet sections |
| `HeatmapTab` | `HeatmapChartView` | Custom grid renderer |
| `AlertsPanel` | `AlertsView` | List with swipe actions |
| `NotificationBell` | Native push + badge | UNUserNotificationCenter |
| `LoadingScreen` | `SplashView` | Launch screen + animated transition |
| `ApprovalGate` | `ApprovalAlert` | `.alert` or custom sheet |
| `AgentControlOverlay` | `AgentControlView` | Animated overlay with cursor |
| `RiskManagement` | `RiskSettingsSheet` | Form in sheet |
| `ReplayControls` | `ReplayControlBar` | Custom control strip |

### Hook → ViewModel/Service Mapping

| Web Hook | iOS Equivalent | Type |
|----------|---------------|------|
| `useAgentStream` | `AgentStreamService` | Service (singleton) |
| `useTradingEngine` | `TradingEngineViewModel` | @Observable class |
| `useChartScripts` | `ChartScriptManager` | Service |
| `useDrawings` | `DrawingManager` | @Observable class |
| `useConvexUser` | `AuthViewModel` | @Observable class |
| `useAgentControl` | `AgentControlManager` | Service |
| `useHoldings` | `HoldingsViewModel` | @Observable class |

---

## 7. Liquid Glass Design System

### Core Principles

Apple's Liquid Glass (iOS 26) is a translucent, depth-aware material system. aFindr's existing glass morphism maps naturally:

```
Web CSS                          →  iOS SwiftUI
─────────────────────────────────────────────────
backdrop-filter: blur(20px)      →  .glassEffect() / .ultraThinMaterial
background: rgba(26,23,20,0.7)   →  .regularMaterial + custom tint
border: 0.667px solid rgba(...)  →  Stroke with ultraThinMaterial
box-shadow: glow effects         →  .shadow(color:radius:)
border-radius: 12px              →  .clipShape(RoundedRectangle(cornerRadius: 12))
```

### Theme System (5 Themes)

```swift
enum AppTheme: String, CaseIterable {
    case darkAmber      // Default - warm brown/amber
    case midnightBlue   // Deep blue
    case forestGreen    // Dark green
    case obsidian       // Pure black
    case classicLight   // Light mode

    var colors: ThemeColors {
        switch self {
        case .darkAmber:
            return ThemeColors(
                background: Color(hex: "#1a1714"),
                backgroundRaised: Color(hex: "#211e1a"),
                accent: Color(hex: "#c47b3a"),
                accentBright: Color(hex: "#d4945a"),
                buy: Color(hex: "#22ab94"),
                sell: Color(hex: "#e54d4d"),
                textPrimary: Color(hex: "#ece3d5"),
                textSecondary: Color(hex: "#ece3d5").opacity(0.65),
                textMuted: Color(hex: "#ece3d5").opacity(0.35),
                glassBg: Color(hex: "#211e1a").opacity(0.6),
                glassBorder: Color.white.opacity(0.06)
            )
        // ... other themes
        }
    }
}
```

### Glass Components Library

```swift
// GlassCard - primary container
struct GlassCard<Content: View>: View {
    @Environment(\.theme) var theme
    let content: () -> Content

    var body: some View {
        content()
            .padding()
            .background(.ultraThinMaterial)
            .background(theme.colors.glassBg)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(theme.colors.glassBorder, lineWidth: 0.667)
            )
    }
}

// GlassButton
struct GlassButton: View { ... }

// GlassPill - nav pills, chips
struct GlassPill: View { ... }

// GlassSheet - bottom sheets
struct GlassSheet<Content: View>: View { ... }

// GlassTabBar - custom tab bar
struct GlassTabBar: View { ... }
```

### Typography Scale

```swift
extension Font {
    static let afindrTitle = Font.system(size: 20, weight: .semibold, design: .default)
    static let afindrHeadline = Font.system(size: 16, weight: .medium)
    static let afindrBody = Font.system(size: 14, weight: .regular)
    static let afindrCaption = Font.system(size: 12, weight: .regular)
    static let afindrMono = Font.system(size: 13, weight: .regular, design: .monospaced) // JetBrains Mono equivalent
    static let afindrMetric = Font.system(size: 24, weight: .bold, design: .rounded)
}
```

### Chip/Badge System

```swift
struct ChipView: View {
    enum Style { case buy, sell, neutral, accent }
    let text: String
    let style: Style
    // Maps to web: .chip-buy, .chip-sell, .chip-neutral, .chip-accent
}
```

### Animation System

```swift
extension Animation {
    static let afindrFast = Animation.easeOut(duration: 0.1)
    static let afindrNormal = Animation.easeOut(duration: 0.2)
    static let afindrSlow = Animation.spring(response: 0.4, dampingFraction: 0.8)
    static let afindrGlass = Animation.spring(response: 0.5, dampingFraction: 0.7) // Liquid glass bounce
}
```

### Haptic Feedback Integration

```swift
enum HapticType {
    case buyTrade      // .success
    case sellTrade     // .warning
    case alertTrigger  // .notification
    case tabSwitch     // .selection
    case drawingPlace  // .light
    case chartSnap     // .rigid
    case error         // .error
}
```

---

## 8. Data Layer & Database

### Convex (Cloud - Shared with Web)

The iOS app connects to the **same Convex deployment** as the web app. All 15+ tables are shared:

```
Shared Convex Tables (Real-time sync):
├── users              → User profiles
├── sessions           → Auth sessions
├── watchlists         → Ticker watchlists
├── tickerTheses       → Per-ticker thesis/sentiment
├── userSettings       → App preferences
├── apiKeys            → Encrypted API keys
├── userMemory         → AI trading profile
├── tokenUsage         → Token billing
├── chatConversations  → Chat sessions
├── chatMessages       → Individual messages
├── positions          → Open positions
├── trades             → Closed trades
├── holdings           → Portfolio holdings
├── backtestRuns       → Saved backtests
├── chartDrawings      → Saved drawings
├── chartScripts       → Custom indicators
├── alerts             → Price/news alerts
└── notifications      → Alert notifications
```

**Convex Swift SDK** provides:
- Real-time subscriptions (live queries)
- Optimistic updates
- Offline queue (mutations retry when online)
- Authentication integration

### SwiftData (Local Cache & Offline)

Local persistence for performance and offline access:

```swift
@Model
class CachedCandle {
    var symbol: String
    var interval: String
    var timestamp: Date
    var open: Double
    var high: Double
    var low: Double
    var close: Double
    var volume: Double

    #Index<CachedCandle>([\.symbol, \.interval, \.timestamp])
}

@Model
class CachedQuote {
    var ticker: String
    var price: Double
    var change: Double
    var changePct: Double
    var lastUpdated: Date
    var ttl: TimeInterval = 60 // 1 min cache
}

@Model
class CachedNewsArticle {
    var id: String
    var headline: String
    var source: String
    var publishedAt: Date
    var category: String
    var sentiment: String?
    var tickers: [String]
    var thumbnailURL: String?
}

@Model
class OfflineTradingState {
    // Mirror of web's localStorage trading state
    var accountBalance: Double
    var equity: Double
    var positions: Data // JSON encoded [Position]
    var orders: Data    // JSON encoded [Order]
    var tradeHistory: Data // JSON encoded [ClosedTrade]
}
```

### Keychain Storage

```swift
// Secure storage for sensitive data
KeychainItems:
├── convex_auth_token    → Convex session token
├── api_key_polygon      → Polygon API key
├── api_key_finnhub      → Finnhub API key
├── api_key_fred         → FRED API key
├── api_key_bls          → BLS API key
└── user_pin_hash        → App lock PIN (if enabled)
```

---

## 9. Backend Integration

### API Client Architecture

The iOS app talks to the **same FastAPI backend** as the web app. No backend changes needed.

```swift
class APIClient {
    static let shared = APIClient()
    private let baseURL: URL // http://api.afindr.com or localhost:8000

    // MARK: - Chat (SSE Streaming)
    func streamChat(_ request: ChatRequest) -> AsyncThrowingStream<AgentEvent, Error>

    // MARK: - Market Data
    func fetchOHLCV(symbol: String, period: String, interval: String) async throws -> [Candle]
    func fetchTicks(symbol: String, date: String, limit: Int) async throws -> [Tick]
    func fetchContracts() async throws -> [Contract]

    // MARK: - News
    func fetchNewsFeed(category: String?, limit: Int) async throws -> [NewsArticle]
    func fetchArticle(url: String) async throws -> ArticleContent
    func fetchNewsForTicker(_ ticker: String) async throws -> [NewsArticle]

    // MARK: - Portfolio
    func fetchQuotes(_ tickers: [String]) async throws -> [Quote]
    func fetchMarketData() async throws -> MarketOverview
    func fetchStockDetail(_ ticker: String) async throws -> StockDetail

    // MARK: - Strategies
    func fetchStrategies() async throws -> [Strategy]
    func fetchPresets() async throws -> [PresetStrategy]
    func runPreset(id: String, params: PresetParams) async throws -> BacktestResult

    // MARK: - Trading
    func openPosition(_ request: PositionRequest) async throws -> Position
    func closePosition(id: String) async throws -> ClosedTrade
    func fetchPositions() async throws -> [Position]
    func fetchTradeHistory() async throws -> [ClosedTrade]
}
```

### SSE Streaming Implementation

```swift
class SSEClient {
    func stream(url: URL, body: Data) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

            let task = URLSession.shared.dataTask(with: request) { ... }
            // Parse SSE events: text_delta, tool_start, tool_result,
            // approval_req, ui_action, done
            // Yield parsed events via continuation
        }
    }
}
```

### Request/Response Models

```swift
struct ChatRequest: Codable {
    let message: String
    let symbol: String
    let period: String
    let interval: String
    let initialBalance: Double?
    let conversationHistory: [ChatMessage]
    let requireApproval: Bool
    let currentPage: String
    let newsHeadlines: [String]?
    let activeScripts: [String]?
    let userProfile: UserProfile?
    let activeAlerts: [Alert]?
}

enum AgentEvent {
    case textDelta(String)
    case toolStart(ToolEvent)
    case toolResult(ToolEvent)
    case approvalRequired(ApprovalRequest)
    case uiAction(UIAction)
    case tokenUpdate(TokenUsage)
    case done(AgentResponse)
    case error(String)
}

struct AgentResponse: Codable {
    let message: String
    let backtestResult: BacktestResult?
    let pinescript: PineScriptResult?
    let monteCarlo: MonteCarloResult?
    let walkForward: WalkForwardResult?
    let chartScripts: [ChartScript]?
    let toolData: [ToolData]?
    let tokenUsage: TokenUsage?
    let durationMs: Int?
}
```

---

## 10. Authentication

### Auth Flow

```
App Launch
    ↓
Check Keychain for Convex auth token
    ↓
┌─ Token exists ──→ Validate with Convex ──→ Valid? ──→ Main App
│                                              │
│                                          Invalid?
│                                              ↓
└─ No token ───────────────────────────→ Auth Screen
                                            │
                              ┌──────────────┼──────────────┐
                              ↓              ↓              ↓
                        Apple Sign-In   Google Sign-In   Email/Pass
                              ↓              ↓              ↓
                        Convex Auth ←────────┘──────────────┘
                              ↓
                        Store token in Keychain
                              ↓
                        First time? → Onboarding
                              ↓
                        Main App
```

### Implementation

```swift
@Observable
class AuthViewModel {
    var isAuthenticated = false
    var currentUser: User?
    var isLoading = true

    private let convexClient: ConvexClient

    // Apple Sign-In
    func signInWithApple() async throws { ... }

    // Google Sign-In (via Convex OAuth)
    func signInWithGoogle() async throws { ... }

    // Email/Password
    func signIn(email: String, password: String) async throws { ... }
    func signUp(email: String, password: String, name: String) async throws { ... }

    // Session management
    func refreshSession() async throws { ... }
    func signOut() async { ... }
}
```

**Note:** Add **Apple Sign-In** as a third auth provider (required for App Store if offering social login). Convex supports custom auth providers.

---

## 11. Charting Engine

### Option A: DGCharts (Recommended for MVP)

[DGCharts](https://github.com/ChartsOrg/Charts) (formerly danielgindi/Charts) is a mature iOS charting library.

**Pros:** Battle-tested, candlestick support, indicators, good performance
**Cons:** UIKit-based (needs UIViewRepresentable wrapper), limited drawing tools

```swift
struct CandlestickChartView: UIViewRepresentable {
    let candles: [Candle]
    let indicators: [IndicatorData]
    let drawings: [ChartDrawing]
    let trades: [TradeMarker]

    func makeUIView(context: Context) -> CandleStickChartView {
        let chart = CandleStickChartView()
        chart.delegate = context.coordinator
        configureChart(chart)
        return chart
    }

    func updateUIView(_ chart: CandleStickChartView, context: Context) {
        updateData(chart)
        updateIndicators(chart)
        updateDrawings(chart)
    }
}
```

### Option B: Custom Metal Renderer (Best Performance, Phase 2)

For production-grade charting with 100k+ candles and smooth 120fps:

```swift
class MetalChartRenderer {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let pipelineState: MTLRenderPipelineState

    // Render candles as instanced quads
    // GPU-accelerated indicator computation
    // Core Graphics overlay for drawings
    // Gesture recognizers for pan/zoom/draw
}
```

### Gesture Interactions

```swift
// Chart gestures (critical for mobile UX)
.gesture(
    MagnificationGesture()  // Pinch to zoom timeframe
    .simultaneously(with: DragGesture())  // Pan through history
)
.onTapGesture { location in
    // Crosshair at tap point
    showCrosshair(at: location)
}
.onLongPressGesture {
    // Context menu: Buy here, Sell here, Set alert, Add drawing
}
```

### Indicator Engine (Port from TypeScript)

The web app computes 25+ indicators client-side. Port to Swift:

```swift
enum IndicatorType: String, CaseIterable {
    case sma, ema, rsi, macd, bollingerBands, vwap, atr
    case stochastic, cci, williamsR, adx, obv, mfi
    case parabolicSAR, donchian, keltner, roc, trix
    case superTrend, aroon, cmo, forceIndex, chaikin
}

protocol IndicatorCalculator {
    func compute(candles: [Candle], params: IndicatorParams) -> IndicatorResult
}

// Example: SMA
struct SMACalculator: IndicatorCalculator {
    func compute(candles: [Candle], params: IndicatorParams) -> IndicatorResult {
        let period = params.period
        var values: [Double?] = Array(repeating: nil, count: candles.count)
        for i in (period - 1)..<candles.count {
            let slice = candles[(i - period + 1)...i]
            values[i] = slice.map(\.close).reduce(0, +) / Double(period)
        }
        return IndicatorResult(type: .sma, values: values)
    }
}
```

### Drawing Tools (14 Types)

Port all 14 drawing types from useDrawings.ts:

```swift
enum DrawingTool: String, CaseIterable {
    case trendLine, horizontalLine, verticalLine, ray
    case arrow, extendedLine, rectangle, channel
    case fibRetracement, measure, ruler, text, brush
    case none // Selection mode
}

protocol ChartDrawing {
    var id: UUID { get }
    var tool: DrawingTool { get }
    var color: Color { get }
    var lineWidth: CGFloat { get }
    func render(in context: GraphicsContext, chartTransform: ChartTransform)
    func hitTest(point: CGPoint, chartTransform: ChartTransform) -> Bool
}
```

---

## 12. AI Copilot (Alphy)

### Chat Interface Design

```
┌─────────────────────────────────────────┐
│  ← Alphy                    ⚡ 0.003$  │  Header with cost tracker
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────┐        │
│  │ 🧪 Running backtest...     │        │  Tool execution card
│  │ ▓▓▓▓▓▓▓▓▓░░░ 75%          │        │
│  └─────────────────────────────┘        │
│                                         │
│  The EMA crossover strategy shows       │  Streaming text (markdown)
│  promising results on NQ 1H...          │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ 📊 Backtest Results         │        │  Expandable result card
│  │ Win Rate: 62.5%            │        │
│  │ Sharpe: 1.84               │        │
│  │ Net P&L: +$4,250           │        │
│  │ [View Full Report →]       │        │
│  └─────────────────────────────┘        │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ ⚠️ Approval Required        │        │  Approval gate
│  │ Run parameter sweep?        │        │
│  │ [Approve] [Deny]           │        │
│  └─────────────────────────────┘        │
│                                         │
├─────────────────────────────────────────┤
│ 📎 NQ=F · 1H    Type a message...  ➤  │  Input bar with context
└─────────────────────────────────────────┘
```

### Copilot ViewModel

```swift
@Observable
class CopilotViewModel {
    var messages: [ChatMessage] = []
    var streamingText: String = ""
    var isStreaming: Bool = false
    var toolEvents: [ToolEvent] = []
    var pendingApproval: ApprovalRequest?
    var tokenUsage: TokenUsage = .zero
    var currentConversationId: String?

    // Context from current screen
    var contextSymbol: String = "NQ=F"
    var contextInterval: String = "1d"
    var contextPage: String = "trade"

    private let apiClient = APIClient.shared
    private let convexClient: ConvexClient

    func sendMessage(_ text: String) async {
        let request = ChatRequest(
            message: text,
            symbol: contextSymbol,
            interval: contextInterval,
            // ... full context
        )

        for try await event in apiClient.streamChat(request) {
            await MainActor.run {
                switch event {
                case .textDelta(let delta):
                    streamingText += delta
                case .toolStart(let tool):
                    toolEvents.append(tool)
                case .toolResult(let result):
                    updateToolEvent(result)
                case .approvalRequired(let req):
                    pendingApproval = req
                case .done(let response):
                    finalizeMessage(response)
                default: break
                }
            }
        }
    }

    func approveToolExecution() async { ... }
    func denyToolExecution() async { ... }
}
```

### Alphy Character (AlphyCompanion)

Port the mood-based character system:

```swift
enum AlphyMood: String {
    case happy, thinking, celebrating, concerned, sleeping

    var emoji: String {
        switch self {
        case .happy: return "😊"
        case .thinking: return "🤔"
        case .celebrating: return "🎉"
        case .concerned: return "😟"
        case .sleeping: return "😴"
        }
    }
}

struct AlphyCompanionView: View {
    let mood: AlphyMood
    let tip: String
    // Animated character with contextual tips
}
```

---

## 13. Trading Engine

### Paper Trading (Port from useTradingEngine.ts)

```swift
@Observable
class TradingEngine {
    var accountState: AccountState

    struct AccountState: Codable {
        var balance: Double = 25_000
        var equity: Double = 25_000
        var unrealizedPnl: Double = 0
        var positions: [Position] = []
        var orders: [Order] = []
        var tradeHistory: [ClosedTrade] = []
    }

    // Contract specifications (matching web)
    static let contracts: [String: ContractSpec] = [
        "NQ=F":  ContractSpec(pointValue: 20, tickSize: 0.25, commission: 2.50),
        "MNQ=F": ContractSpec(pointValue: 2,  tickSize: 0.25, commission: 0.50),
        "ES=F":  ContractSpec(pointValue: 50, tickSize: 0.25, commission: 2.50),
        "GC=F":  ContractSpec(pointValue: 100, tickSize: 0.10, commission: 2.50),
        "CL=F":  ContractSpec(pointValue: 1000, tickSize: 0.01, commission: 2.50),
    ]

    func openPosition(symbol: String, side: Side, size: Int,
                      price: Double, stopLoss: Double?, takeProfit: Double?) { ... }
    func closePosition(id: String, exitPrice: Double) { ... }
    func closeAllPositions(currentPrices: [String: Double]) { ... }
    func updateStopLoss(positionId: String, newSL: Double) { ... }
    func updateTakeProfit(positionId: String, newTP: Double) { ... }

    // Persistence
    func save() { /* SwiftData + Convex sync */ }
    func load() { /* SwiftData cache, then Convex */ }
}
```

---

## 14. Push Notifications & Alerts

### Alert System

The web app has price and news alerts stored in Convex. The iOS app adds native push:

```swift
class AlertService {
    // Local notifications for price alerts (checked via background task)
    func scheduleLocalAlert(_ alert: PriceAlert) { ... }

    // Remote push via Convex (server-side alert checking)
    func registerForRemotePush() async { ... }

    // Background task for price checking
    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.afindr.priceCheck",
            using: nil
        ) { task in
            self.handlePriceCheck(task: task as! BGAppRefreshTask)
        }
    }
}
```

### Widget Support (WidgetKit)

```swift
// Lock screen widget: Current portfolio P&L
struct PortfolioPnLWidget: Widget { ... }

// Home screen widget: Watchlist prices
struct WatchlistWidget: Widget { ... }

// Live Activity: Active trade position tracking
struct TradePositionActivity: Widget { ... }
```

---

## 15. Dependencies & Packages

### Swift Package Manager (Package.swift)

```swift
dependencies: [
    // Database
    .package(url: "https://github.com/nicklama/convex-swift", from: "0.1.0"),

    // Charts
    .package(url: "https://github.com/ChartsOrg/Charts", from: "5.0.0"),

    // Networking
    .package(url: "https://github.com/daltoniam/Starscream", from: "4.0.0"),

    // Security
    .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.0"),

    // UI
    .package(url: "https://github.com/airbnb/lottie-ios", from: "4.4.0"),
    .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.3.0"),
    .package(url: "https://github.com/nicklama/HighlightSwift", from: "1.0.0"),
    .package(url: "https://github.com/SDWebImage/SDWebImageSwiftUI", from: "3.0.0"),

    // Utilities
    .package(url: "https://github.com/realm/SwiftLint", from: "0.55.0"),
]
```

### System Frameworks
```
SwiftUI          → UI framework
SwiftData        → Local persistence
AuthenticationServices → Apple Sign-In
UserNotifications → Push & local notifications
BackgroundTasks  → Background price checking
WidgetKit        → Home screen/lock screen widgets
ActivityKit      → Live Activities for trades
Metal            → GPU-accelerated chart rendering (Phase 2)
CoreGraphics     → Drawing tools rendering
CoreHaptics      → Haptic feedback
StoreKit         → In-app purchases (if monetizing)
```

---

## 16. Project Structure

```
aFindr-iOS/
├── aFindr.xcodeproj
├── Package.swift
│
├── aFindr/
│   ├── App/
│   │   ├── aFindrApp.swift              # @main entry point
│   │   ├── AppDelegate.swift            # Push notifications, background tasks
│   │   └── ContentView.swift            # Auth gate → TabView
│   │
│   ├── Core/
│   │   ├── Theme/
│   │   │   ├── AppTheme.swift           # Theme enum + colors
│   │   │   ├── GlassComponents.swift    # GlassCard, GlassPill, etc.
│   │   │   ├── Typography.swift         # Font definitions
│   │   │   └── ThemeEnvironment.swift   # @Environment(\.theme)
│   │   ├── Extensions/
│   │   │   ├── Color+Hex.swift
│   │   │   ├── Date+Formatting.swift
│   │   │   ├── Double+Currency.swift
│   │   │   └── View+Glass.swift
│   │   ├── Haptics/
│   │   │   └── HapticManager.swift
│   │   └── Constants.swift              # API URLs, timeouts, etc.
│   │
│   ├── Models/
│   │   ├── Candle.swift
│   │   ├── Trade.swift
│   │   ├── Position.swift
│   │   ├── Order.swift
│   │   ├── BacktestResult.swift
│   │   ├── ChatMessage.swift
│   │   ├── AgentEvent.swift
│   │   ├── NewsArticle.swift
│   │   ├── Alert.swift
│   │   ├── Indicator.swift
│   │   ├── Drawing.swift
│   │   ├── UserSettings.swift
│   │   └── ContractSpec.swift
│   │
│   ├── Services/
│   │   ├── API/
│   │   │   ├── APIClient.swift          # Base HTTP client
│   │   │   ├── SSEClient.swift          # Server-Sent Events parser
│   │   │   ├── ChatAPI.swift            # Chat endpoints
│   │   │   ├── MarketDataAPI.swift      # OHLCV, quotes, ticks
│   │   │   ├── NewsAPI.swift            # News endpoints
│   │   │   ├── PortfolioAPI.swift       # Portfolio endpoints
│   │   │   ├── StrategyAPI.swift        # Strategy endpoints
│   │   │   └── TradingAPI.swift         # Trading endpoints
│   │   ├── Convex/
│   │   │   ├── ConvexService.swift      # Convex client wrapper
│   │   │   └── ConvexQueries.swift      # Query/mutation definitions
│   │   ├── Auth/
│   │   │   ├── AuthService.swift        # Auth orchestration
│   │   │   ├── AppleSignIn.swift        # ASAuthorization
│   │   │   └── KeychainService.swift    # Secure storage
│   │   ├── Notifications/
│   │   │   ├── PushService.swift        # Remote push
│   │   │   └── AlertChecker.swift       # Background price alerts
│   │   └── Cache/
│   │       └── CacheManager.swift       # SwiftData cache logic
│   │
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── HomeViewModel.swift
│   │   ├── PortfolioViewModel.swift
│   │   ├── TradeViewModel.swift
│   │   ├── ChartViewModel.swift
│   │   ├── CopilotViewModel.swift
│   │   ├── NewsViewModel.swift
│   │   ├── AlphaViewModel.swift
│   │   ├── SettingsViewModel.swift
│   │   ├── TradingEngine.swift
│   │   ├── DrawingManager.swift
│   │   ├── IndicatorManager.swift
│   │   └── AlertViewModel.swift
│   │
│   ├── Views/
│   │   ├── Auth/
│   │   │   ├── AuthView.swift           # Login screen
│   │   │   └── OnboardingView.swift     # 6-step wizard
│   │   ├── Home/
│   │   │   ├── HomeView.swift           # Dashboard tab
│   │   │   ├── PortfolioSummaryCard.swift
│   │   │   ├── WatchlistSection.swift
│   │   │   ├── ThesisSection.swift
│   │   │   ├── JournalView.swift
│   │   │   └── LibraryView.swift
│   │   ├── Portfolio/
│   │   │   ├── PortfolioView.swift      # Holdings list
│   │   │   ├── HoldingRow.swift
│   │   │   ├── StockDetailView.swift
│   │   │   └── OrderSheet.swift
│   │   ├── Trade/
│   │   │   ├── TradeView.swift          # Chart screen
│   │   │   ├── SymbolToolbar.swift
│   │   │   ├── DrawingToolStrip.swift
│   │   │   ├── QuickTradeBar.swift
│   │   │   ├── ReplayControlBar.swift
│   │   │   └── PositionsSheet.swift
│   │   ├── Chart/
│   │   │   ├── CandlestickChartView.swift
│   │   │   ├── IndicatorOverlay.swift
│   │   │   ├── DrawingOverlay.swift
│   │   │   ├── TradeMarkerOverlay.swift
│   │   │   ├── CrosshairView.swift
│   │   │   └── ChartContextMenu.swift
│   │   ├── News/
│   │   │   ├── NewsView.swift
│   │   │   ├── NewsCard.swift
│   │   │   └── ArticleDetailView.swift
│   │   ├── Alpha/
│   │   │   ├── AlphaView.swift          # AI research
│   │   │   ├── ChatBubble.swift
│   │   │   ├── ToolEventCard.swift
│   │   │   ├── BacktestResultCard.swift
│   │   │   ├── PineScriptCard.swift
│   │   │   ├── MonteCarloCard.swift
│   │   │   ├── ApprovalCard.swift
│   │   │   └── TokenUsageBadge.swift
│   │   ├── Copilot/
│   │   │   ├── CopilotSheet.swift       # Floating copilot
│   │   │   └── CopilotInputBar.swift
│   │   ├── Settings/
│   │   │   ├── SettingsView.swift
│   │   │   ├── AccountSettingsView.swift
│   │   │   ├── TradingSettingsView.swift
│   │   │   ├── AppearanceSettingsView.swift
│   │   │   ├── BrokerSettingsView.swift
│   │   │   └── APIKeysSettingsView.swift
│   │   ├── StrategyTester/
│   │   │   ├── StrategyTesterSheet.swift
│   │   │   ├── OverviewTab.swift
│   │   │   ├── TradesTab.swift
│   │   │   ├── MonteCarloTab.swift
│   │   │   ├── WalkForwardTab.swift
│   │   │   ├── HeatmapTab.swift
│   │   │   └── RunLogTab.swift
│   │   ├── Symbols/
│   │   │   ├── SymbolSearchView.swift
│   │   │   └── SymbolRow.swift
│   │   ├── Alerts/
│   │   │   ├── AlertsView.swift
│   │   │   └── CreateAlertSheet.swift
│   │   └── Shared/
│   │       ├── ChipView.swift
│   │       ├── SparklineView.swift
│   │       ├── LoadingView.swift
│   │       ├── EmptyStateView.swift
│   │       ├── ErrorView.swift
│   │       └── MetricGrid.swift
│   │
│   ├── Widgets/
│   │   ├── PortfolioPnLWidget.swift
│   │   ├── WatchlistWidget.swift
│   │   └── TradeActivityWidget.swift
│   │
│   └── Resources/
│       ├── Assets.xcassets
│       ├── Localizable.strings
│       └── Info.plist
│
├── aFindrTests/
│   ├── ViewModelTests/
│   ├── ServiceTests/
│   └── ModelTests/
│
└── aFindrUITests/
    └── ScreenTests/
```

---

## 17. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal:** App shell, auth, navigation, theme system

- [ ] Xcode project setup with SPM dependencies
- [ ] Theme system (5 themes + Liquid Glass components)
- [ ] `GlassCard`, `GlassPill`, `GlassButton`, `GlassSheet` components
- [ ] `AppTheme` enum with all color definitions
- [ ] Typography scale + haptic manager
- [ ] Auth flow (Apple Sign-In + Google + Email/Password)
- [ ] Convex Swift SDK integration
- [ ] TabView with 5 tabs (Home, Portfolio, Trade, News, Alpha)
- [ ] Settings view with all sections (Form-based)
- [ ] Onboarding wizard (6 steps)
- [ ] API client base with async/await
- [ ] Keychain service for secure storage
- [ ] SwiftData models for local caching

**Deliverable:** Navigable app shell with auth, themes, and settings

---

### Phase 2: Data & Market Layer (Weeks 4-5)
**Goal:** Market data flowing, symbol search, quotes

- [ ] OHLCV data fetching + caching (SwiftData)
- [ ] Real-time quotes polling
- [ ] Symbol search with 200+ symbols (6 categories)
- [ ] News feed integration
- [ ] Article detail view
- [ ] Portfolio quotes endpoint
- [ ] Market data (indices, sectors)
- [ ] Stock detail view (stats, analyst ratings)
- [ ] News sentiment chips
- [ ] Ticker detection in news

**Deliverable:** News and portfolio data flowing with search

---

### Phase 3: Charting Engine (Weeks 6-9)
**Goal:** Full interactive chart with indicators and drawings

- [ ] Candlestick chart (DGCharts integration)
- [ ] Pinch-to-zoom and pan gestures
- [ ] Crosshair on tap
- [ ] 25+ indicator calculations (port from TypeScript)
- [ ] Indicator overlay rendering
- [ ] Indicator search/add/remove UI
- [ ] 14 drawing tools implementation
- [ ] Drawing gesture handlers (touch-based)
- [ ] Drawing edit/delete UI
- [ ] Trade markers (entry/exit arrows)
- [ ] Position lines (stop-loss, take-profit)
- [ ] Timeframe selector (1m → 1M)
- [ ] Chart context menu (long-press)

**Deliverable:** Production-quality interactive chart

---

### Phase 4: AI Copilot (Weeks 10-12)
**Goal:** Full AI chat with streaming and tool visualization

- [ ] SSE client implementation
- [ ] Chat message list UI (markdown rendering)
- [ ] Token-by-token streaming text display
- [ ] Tool execution cards (expanding, status indicators)
- [ ] Backtest result cards (inline metrics + mini equity curve)
- [ ] PineScript code display (syntax highlighted)
- [ ] Monte Carlo visualization card
- [ ] Options chain card
- [ ] Approval gate (approve/deny buttons)
- [ ] Token usage tracking badge
- [ ] Conversation management (save/load via Convex)
- [ ] Context injection (current symbol, interval, page)
- [ ] Floating copilot button (FAB) on Trade screen
- [ ] Full-screen Alpha Lab chat view

**Deliverable:** Complete AI copilot with streaming and rich results

---

### Phase 5: Trading Engine (Weeks 13-14)
**Goal:** Paper trading with positions, orders, history

- [ ] Trading engine (port from useTradingEngine.ts)
- [ ] Position opening (BUY/SELL from chart)
- [ ] Position closing (swipe or button)
- [ ] Stop-loss / take-profit management
- [ ] Order book (limit orders)
- [ ] Trade history with P&L
- [ ] Account summary (balance, equity, unrealized P&L)
- [ ] Positions bottom sheet on Trade screen
- [ ] Quick trade bar
- [ ] Commission calculations per contract type
- [ ] Sync trading state with Convex

**Deliverable:** Functional paper trading system

---

### Phase 6: Strategy Tester (Weeks 15-17)
**Goal:** Backtest results visualization

- [ ] Strategy tester bottom sheet (tabbed)
- [ ] Overview tab: Metrics grid + equity curve chart
- [ ] Trades tab: Trade list with P&L coloring
- [ ] Monte Carlo tab: Distribution chart + percentiles
- [ ] Walk-forward tab: Window metrics + robustness ratio
- [ ] Heatmap tab: Parameter sweep grid (custom renderer)
- [ ] Analysis tab: Trade pattern metrics
- [ ] Strategies tab: Saved strategy list
- [ ] Run log tab: Agent execution timeline
- [ ] Replay controls (play, step, speed)
- [ ] Historical replay mode

**Deliverable:** Full backtest visualization and replay

---

### Phase 7: Dashboard & Portfolio (Weeks 18-19)
**Goal:** Home dashboard and portfolio management

- [ ] Home dashboard layout (cards)
- [ ] Portfolio summary card with sparkline
- [ ] Watchlist section (horizontal scroll)
- [ ] Thesis tracking section
- [ ] Holdings list with detail navigation
- [ ] Stock detail view with chart
- [ ] Order placement sheet
- [ ] Market session indicator
- [ ] Daily greeting + content
- [ ] Journal view
- [ ] Library view

**Deliverable:** Complete dashboard and portfolio experience

---

### Phase 8: Alerts & Notifications (Weeks 20-21)
**Goal:** Price alerts and push notifications

- [ ] Alert creation UI (price level, condition)
- [ ] Alerts list with swipe actions
- [ ] Local notification scheduling
- [ ] Background task for price checking
- [ ] Push notification registration
- [ ] Notification center view
- [ ] Alert badge on tab bar
- [ ] News alert conditions

**Deliverable:** Working alert system with push

---

### Phase 9: Widgets & Polish (Weeks 22-24)
**Goal:** iOS widgets, performance, and polish

- [ ] Portfolio P&L widget (WidgetKit)
- [ ] Watchlist widget
- [ ] Live Activity for active trades
- [ ] Performance profiling (Instruments)
- [ ] Memory optimization
- [ ] Accessibility audit (VoiceOver, Dynamic Type)
- [ ] Localization (English, Swahili)
- [ ] App icon and launch screen
- [ ] Dark/light mode system integration
- [ ] Edge cases and error handling
- [ ] Crash reporting (Firebase Crashlytics or Sentry)

**Deliverable:** Polished, widget-enabled app

---

### Phase 10: Testing & App Store (Weeks 25-26)
**Goal:** Testing, beta, and submission

- [ ] Unit tests (ViewModels, Services, Models)
- [ ] Integration tests (API, Convex, Auth)
- [ ] UI tests (critical flows)
- [ ] TestFlight beta distribution
- [ ] App Store screenshots and metadata
- [ ] Privacy policy and terms of service
- [ ] App Store review guidelines compliance
- [ ] Submit for review

**Deliverable:** App Store-ready build

---

## 18. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Chart performance on older iPhones** | High | Profile early; DGCharts → Metal fallback |
| **Convex Swift SDK maturity** | Medium | Abstract behind protocol; fallback to REST API |
| **SSE streaming reliability on cellular** | Medium | Retry logic, offline queue, progress resumption |
| **Liquid Glass availability (iOS 26)** | Low | Graceful fallback to `.ultraThinMaterial` on iOS 18 |
| **App Store rejection (finance app)** | Medium | Disclaimers, paper-trading only, no real money |
| **Drawing tools gesture conflicts** | Medium | Mode-based gestures; clear tool selection UX |
| **Large backtest data on mobile** | Medium | Paginate results; stream equity curve points |
| **Background task limitations** | Low | Rely on server-side alert checking (Convex crons) |
| **Memory pressure (chart + AI chat)** | Medium | Lazy loading, view recycling, data pagination |

---

## 19. Performance Targets

| Metric | Target |
|--------|--------|
| App launch → interactive | < 2 seconds |
| Chart render (1000 candles) | < 100ms |
| Chart scroll (pan/zoom) | 60fps minimum, 120fps on ProMotion |
| AI chat first token | < 500ms |
| Symbol search results | < 100ms |
| Memory usage (chart active) | < 200MB |
| Memory usage (idle) | < 80MB |
| Battery drain (1hr active use) | < 15% |
| Offline → online sync | < 3 seconds |
| Push notification delivery | < 5 seconds |

---

## 20. App Store Considerations

### Required Disclosures
- **Paper trading disclaimer:** "This app simulates trading. No real money is involved."
- **AI disclaimer:** "AI-generated strategies are for educational purposes. Not financial advice."
- **Data sources:** Credit all data providers (Yahoo Finance, FRED, BLS, etc.)

### Privacy
- **App Tracking Transparency:** Not required (no third-party tracking)
- **Privacy Nutrition Label:**
  - Name, email (account creation)
  - Financial data (simulated portfolio)
  - Usage data (analytics)
  - No data sold to third parties

### In-App Purchases (If Monetizing)
- Free tier: Basic charting, limited AI queries
- Pro tier: Unlimited AI, all indicators, backtesting, alerts
- Use StoreKit 2 for subscription management

### Minimum Requirements
- iOS 18.0+
- iPhone only (iPad optimization in future update)
- ~100MB download size (estimated)

---

## Appendix A: Environment Variables (iOS)

```
// Stored in Xcode scheme or .xcconfig (NOT in code)
FASTAPI_BASE_URL=https://api.afindr.com  // or localhost:8000 for dev
CONVEX_DEPLOYMENT_URL=https://xxx.convex.cloud
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## Appendix B: Backend Changes Required

The existing FastAPI backend needs **minimal changes** for mobile:

1. **CORS:** Add mobile app's origin to `CORS_ORIGINS`
2. **Auth:** Validate Convex JWT from iOS client (already supported)
3. **Push tokens:** Add endpoint to register APNs device tokens
4. **No other changes** - all existing endpoints work for mobile

## Appendix C: Convex Schema Additions

```typescript
// Add to convex/schema.ts for mobile support:

// Device tokens for push notifications
deviceTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    createdAt: v.number(),
}).index("by_user", ["userId"]),
```

---

*This plan was generated from a read-only audit of the aFindr codebase on 2026-02-24. No source code was modified.*
