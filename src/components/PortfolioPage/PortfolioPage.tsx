"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AccountState } from "@/lib/types";
import type { AppPage } from "@/components/PageNav/PageNav";
import PortfolioDashboard from "./PortfolioDashboard";
import WatchlistSidebar from "./WatchlistSidebar";
import StockDetailView from "./StockDetailView";
import OrderPanel from "./OrderPanel";

interface PortfolioPageProps {
  accountState: AccountState;
  currentPrice: number;
  onNavigateToChart?: (ticker: string) => void;
  onPageChange?: (page: AppPage) => void;
  onOpenSettings?: () => void;
  initialTicker?: string | null;
  onInitialTickerConsumed?: () => void;
}

export default function PortfolioPage({ accountState, currentPrice, onNavigateToChart, onPageChange, onOpenSettings, initialTicker, onInitialTickerConsumed }: PortfolioPageProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(initialTicker ?? null);

  // Consume initialTicker when it changes (e.g. navigating from dashboard)
  useEffect(() => {
    if (initialTicker) {
      setSelectedTicker(initialTicker);
      setDetailPrice(0);
      setDetailName(initialTicker);
      onInitialTickerConsumed?.();
    }
  }, [initialTicker, onInitialTickerConsumed]);

  // Track detail data for the order panel
  const [detailPrice, setDetailPrice] = useState(0);
  const [detailName, setDetailName] = useState("");

  const handleSelectTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    // Reset detail info - will be updated when StockDetailView loads
    setDetailPrice(0);
    setDetailName(ticker);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTicker(null);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <AnimatePresence mode="wait">
        {selectedTicker === null ? (
          /* ─── Dashboard View: Main Content + Watchlist Sidebar ─── */
          <motion.div
            key="dashboard"
            className="flex flex-1 overflow-hidden"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <PortfolioDashboard
              accountState={accountState}
              onSelectTicker={handleSelectTicker}
              onPageChange={onPageChange ?? (() => {})}
              onOpenSettings={onOpenSettings ?? (() => {})}
            />
            {/* Right column: padded so the card floats with margin */}
            <div style={{ padding: 16, flexShrink: 0 }}>
              <WatchlistSidebar
                onSelectTicker={handleSelectTicker}
              />
            </div>
          </motion.div>
        ) : (
          /* ─── Stock Detail View: Detail Content + Order Panel ─── */
          <motion.div
            key={`detail-${selectedTicker}`}
            className="flex flex-1 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <StockDetailView
              ticker={selectedTicker}
              onBack={handleBack}
              onSelectTicker={handleSelectTicker}
              onNavigateToChart={onNavigateToChart}
            />
            {/* Right column: padded so the card floats with margin */}
            <div style={{ padding: 16, flexShrink: 0 }}>
              <OrderPanel
                ticker={selectedTicker}
                name={detailName}
                price={detailPrice || currentPrice}
                balance={accountState.balance}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
