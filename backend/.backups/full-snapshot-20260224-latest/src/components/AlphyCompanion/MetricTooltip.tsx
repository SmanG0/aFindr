"use client";

import { useState, useRef, type ReactNode } from "react";

// ─── Metric Explanations Database ───

const METRIC_EXPLANATIONS: Record<string, { title: string; explain: string; good: string }> = {
  winRate: {
    title: "Win Rate",
    explain: "Percentage of trades that were profitable. A 60% win rate means 6 out of 10 trades made money.",
    good: "Above 50% is decent. Above 60% is strong. But a low win rate can still be profitable with high reward-to-risk.",
  },
  profitFactor: {
    title: "Profit Factor",
    explain: "Total gross profit divided by total gross loss. A profit factor of 2.0 means you made $2 for every $1 lost.",
    good: "Above 1.5 is good. Above 2.0 is excellent. Below 1.0 means the strategy is losing money overall.",
  },
  sharpeRatio: {
    title: "Sharpe Ratio",
    explain: "Risk-adjusted return — how much return you get per unit of risk (volatility). Higher is better.",
    good: "Above 1.0 is acceptable. Above 2.0 is very good. Above 3.0 is exceptional.",
  },
  sortinoRatio: {
    title: "Sortino Ratio",
    explain: "Like Sharpe, but only penalizes downside volatility. Doesn't punish you for upside swings.",
    good: "Generally higher than Sharpe for strategies with positive skew. Above 2.0 is strong.",
  },
  maxDrawdown: {
    title: "Max Drawdown",
    explain: "The largest peak-to-trough decline in your equity. If your account went from $100K to $80K, that's a 20% drawdown.",
    good: "Under 20% is manageable. Under 10% is conservative. Above 30% is psychologically very difficult to recover from.",
  },
  maxDrawdownPct: {
    title: "Max Drawdown %",
    explain: "The largest percentage decline from a peak in equity. This measures your worst-case scenario.",
    good: "Keep this below your pain threshold. Most professional traders target under 15-20%.",
  },
  calmarRatio: {
    title: "Calmar Ratio",
    explain: "Annual return divided by max drawdown. Measures how much return you get per unit of worst-case pain.",
    good: "Above 1.0 is decent. Above 3.0 is excellent. It's a great way to compare strategies on a risk-adjusted basis.",
  },
  expectancy: {
    title: "Expectancy",
    explain: "The average amount you can expect to win (or lose) per trade. Factors in both win rate and average win/loss size.",
    good: "Positive expectancy means you'll make money over time. Multiply by trade frequency for expected monthly income.",
  },
  totalReturn: {
    title: "Total Return",
    explain: "The absolute dollar amount gained or lost from the strategy, before accounting for initial capital.",
    good: "Context matters — $5K on a $100K account is very different from $5K on a $10K account.",
  },
  totalReturnPct: {
    title: "Total Return %",
    explain: "Total return as a percentage of starting capital. A more comparable metric than raw dollars.",
    good: "Compare against a benchmark (like SPY). Beating the market risk-adjusted is what matters.",
  },
  avgWin: {
    title: "Average Win",
    explain: "The average profit on winning trades. Compare this to your average loss for the reward-to-risk ratio.",
    good: "Ideally 1.5-3x your average loss. Even with a 40% win rate, a 3:1 reward-to-risk is very profitable.",
  },
  avgLoss: {
    title: "Average Loss",
    explain: "The average loss on losing trades. This should be controlled by your stop-loss discipline.",
    good: "Consistency matters more than the absolute number. Volatile average losses suggest poor risk management.",
  },
  maxConsecutiveLosses: {
    title: "Max Consecutive Losses",
    explain: "The longest losing streak in the backtest. This tests your psychological endurance.",
    good: "5-7 is normal. Above 10 is tough to stomach. Make sure your position sizing can handle the worst streak.",
  },
  maxConsecutiveWins: {
    title: "Max Consecutive Wins",
    explain: "The longest winning streak. Don't let this inflate your confidence — it's often followed by regression.",
    good: "Enjoy it, but don't increase position size during a streak. Mean reversion applies to your P&L too.",
  },
  recoveryFactor: {
    title: "Recovery Factor",
    explain: "Total net profit divided by max drawdown. Shows how well the strategy recovers from its worst loss.",
    good: "Above 3.0 is solid. Above 5.0 is excellent. A high recovery factor means drawdowns are quickly recouped.",
  },
  payoffRatio: {
    title: "Payoff Ratio",
    explain: "Average win divided by average loss. Also called reward-to-risk ratio.",
    good: "Above 1.5 with a decent win rate is the sweet spot. Some trend-following strategies target 3:1+.",
  },
  deflatedSharpeRatio: {
    title: "Deflated Sharpe Ratio",
    explain: "Adjusts the Sharpe ratio for multiple testing bias. If you tested 100 strategies, some will look good by chance — this corrects for that.",
    good: "A DSR above 0.95 means the strategy likely has real edge, not just data-mining luck.",
  },
  probabilityOfRuin: {
    title: "Probability of Ruin",
    explain: "The chance of losing all your capital based on Monte Carlo simulations of your trade distribution.",
    good: "Should be as close to 0% as possible. Above 5% means you need to reduce position size or improve the strategy.",
  },
  robustnessRatio: {
    title: "Robustness Ratio",
    explain: "Compares out-of-sample vs in-sample performance in walk-forward analysis. Shows if the strategy holds up on unseen data.",
    good: "Above 0.5 is acceptable. Above 0.7 is good. Below 0.3 suggests overfitting.",
  },
};

// ─── Tooltip Component ───

interface MetricTooltipProps {
  /** The metric key from METRIC_EXPLANATIONS */
  metricKey: string;
  /** The content to wrap (the metric value display) */
  children: ReactNode;
}

export default function MetricTooltip({ metricKey, children }: MetricTooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const explanation = METRIC_EXPLANATIONS[metricKey];
  if (!explanation) return <>{children}</>;

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: "help", borderBottom: "1px dotted rgba(236,227,213,0.2)" }}
      >
        {children}
      </span>

      {show && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
            zIndex: 10000,
            maxWidth: 300,
            background: "rgba(25,23,20,0.98)",
            border: "1px solid rgba(236,227,213,0.12)",
            borderRadius: 12,
            padding: "14px 16px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        >
          {/* Header with Alphy branding */}
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="6" fill="var(--accent)" />
              <text x="16" y="22" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff" fontFamily="Georgia, serif">&alpha;</text>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-bright)", fontFamily: "var(--font-mono)" }}>
              {explanation.title}
            </span>
          </div>

          {/* Explanation */}
          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
            {explanation.explain}
          </div>

          {/* What's good */}
          <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4, fontStyle: "italic" }}>
            {explanation.good}
          </div>

          {/* Tail */}
          <div
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "rgba(25,23,20,0.98)",
              borderRight: "1px solid rgba(236,227,213,0.12)",
              borderBottom: "1px solid rgba(236,227,213,0.12)",
            }}
          />
        </div>
      )}
    </>
  );
}

/** Get all available metric keys for reference */
export function getMetricKeys(): string[] {
  return Object.keys(METRIC_EXPLANATIONS);
}
