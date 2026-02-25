// ─── Dashboard Content: Books, Quotes, and Helpers ───

export interface TradingBook {
  id: string;
  title: string;
  author: string;
  tagline: string;
  pullQuote: string;
  category: "psychology" | "technical" | "fundamentals" | "risk" | "philosophy";
  level: "beginner" | "intermediate" | "advanced" | "all";
  coverAccent: string;
  isbn: string;
}

export type QuoteCategory = "mindset" | "risk" | "strategy" | "philosophy" | "discipline" | "wisdom";

export interface TradingQuote {
  text: string;
  author: string;
  source?: string;
  category: QuoteCategory;
}

// ─── Author Profiles ───

export type ApproachTag = "fundamental" | "technical" | "macro" | "quantitative" | "momentum" | "value" | "contrarian" | "trend-following" | "hybrid" | "philosophy";

export interface AuthorProfile {
  name: string;
  era: string;
  peakReturns: string;
  netWorth?: string;
  backstory: string;
  approach: string;
  approachTag: ApproachTag;
  thesis: string;
  keyMetrics: string[];
  famousFor: string;
  // ─── Enriched fields ───
  corePrinciples: string[];
  methodologyDetail: string;
  riskManagement: string;
  psychologyEdge: string;
  notableTrade?: string;
  influences: string[];
}

const APPROACH_TAG_COLORS: Record<ApproachTag, string> = {
  fundamental: "#4a6a52",
  technical: "#7a5c3a",
  macro: "#3a8fc4",
  quantitative: "#6a5a3a",
  momentum: "#c47b3a",
  value: "#22ab94",
  contrarian: "#e54d4d",
  "trend-following": "#b8952a",
  hybrid: "#7c6bbf",
  philosophy: "#5a4a6a",
};

export { APPROACH_TAG_COLORS };

export const AUTHOR_PROFILES: Record<string, AuthorProfile> = {
  "Warren Buffett": {
    name: "Warren Buffett",
    era: "1956 - present",
    peakReturns: "~19.8% CAGR over 60 years (5,502,284% cumulative)",
    netWorth: "~$149B",
    backstory: "Born in Omaha, Nebraska in 1930. Bought his first stock at age 11, filed taxes at 13. Studied under Benjamin Graham at Columbia Business School, ran investment partnerships from 1956, then took control of Berkshire Hathaway in 1965 and transformed a failing textile company into the world's most successful holding company.",
    approach: "Fundamental Value Investing",
    approachTag: "value",
    thesis: "Seeks businesses with durable competitive advantages (moats), consistent 20%+ YoY revenue growth, high retained earnings growth, and management integrity. Buys businesses he understands at a discount to intrinsic value and holds indefinitely. Evolved from Graham's deep-value to paying fair prices for wonderful businesses with strong brand loyalty and pricing power.",
    keyMetrics: ["ROE > 15% consistently", "Low Debt/Equity", "Predictable owner earnings growth", "Wide economic moat"],
    famousFor: "The 'Oracle of Omaha' — greatest long-term compounder in history",
  },
  "Benjamin Graham": {
    name: "Benjamin Graham",
    era: "1926 - 1956",
    peakReturns: "~20% annualized (Graham-Newman Corp) vs 12.2% S&P 500",
    netWorth: "~$3-50M at death (1976)",
    backstory: "Born in London in 1894, family moved to New York. Father died when he was nine, family faced hardship during the Panic of 1907. Graduated from Columbia at 20, went to Wall Street, and founded Graham-Newman in 1926.",
    approach: "Deep Value / Margin of Safety",
    approachTag: "value",
    thesis: "Pioneered 'margin of safety' — buying stocks trading significantly below intrinsic value based on tangible assets and earnings. Treated the market as 'Mr. Market,' an emotional counterparty offering irrational prices. Focused on quantitative screening for statistically cheap 'net-net' stocks trading below net current asset value.",
    keyMetrics: ["Price < 2/3 Net Current Asset Value", "P/E < 15", "Debt/Equity < 1.0", "10+ years positive earnings"],
    famousFor: "The 'Father of Value Investing' — wrote The Intelligent Investor",
  },
  "Peter Lynch": {
    name: "Peter Lynch",
    era: "1977 - 1990",
    peakReturns: "29.2% annualized over 13 years (Magellan Fund)",
    netWorth: "~$450M",
    backstory: "Born in Newton, Massachusetts in 1944. Lost his father at age 10, worked as a golf caddy. While caddying at Brae Burn Country Club he met Fidelity's president, which led to an internship. Grew the Magellan Fund from $18M to $14B AUM.",
    approach: "Growth at a Reasonable Price (GARP)",
    approachTag: "hybrid",
    thesis: "Believed ordinary people can beat Wall Street by 'investing in what you know' — finding great companies through everyday consumer experience before analysts discover them. Classified stocks into six categories and applied different criteria to each. Used the PEG ratio as his primary tool, seeking P/E at or below earnings growth rate.",
    keyMetrics: ["PEG ratio <= 1.0", "Earnings growth 20-25%", "Low debt-to-equity", "Strong free cash flow"],
    famousFor: "Best-performing mutual fund manager in history",
  },
  "Charlie Munger": {
    name: "Charlie Munger",
    era: "1962 - 2023",
    peakReturns: "19.8% CAGR (1962-1975 partnership) vs 5.0% Dow",
    netWorth: "~$2.5B at death (2023)",
    backstory: "Born in Omaha in 1924. Studied mathematics at Michigan, served in WWII, earned his JD from Harvard Law without an undergraduate degree. Practiced law before transitioning to investing. Became Berkshire's vice chairman in 1978 and Buffett's closest intellectual partner for 45+ years.",
    approach: "Quality-Focused Value / Mental Models",
    approachTag: "fundamental",
    thesis: "Shifted Berkshire's philosophy from 'fair businesses at wonderful prices' to 'wonderful businesses at fair prices.' Advocated concentrated portfolios of exceptional businesses. Applied a 'latticework of mental models' from psychology, physics, biology, and economics to identify mispricings and avoid cognitive biases.",
    keyMetrics: ["Durable competitive advantage", "High ROIC", "Trustworthy management", "Simple, understandable model"],
    famousFor: "Buffett's indispensable partner — 'Invert, always invert'",
  },
  "George Soros": {
    name: "George Soros",
    era: "1969 - 2011",
    peakReturns: "~30% annualized (Quantum Fund, 1973-2000)",
    netWorth: "~$7.2B (after donating $32B+)",
    backstory: "Born in Budapest in 1930. Survived Nazi occupation as a teenager by posing as a Christian. Escaped communist Hungary in 1947, arrived in London penniless, studied at LSE under Karl Popper. Emigrated to the U.S. in 1956, launched his first hedge fund in 1969.",
    approach: "Global Macro / Reflexivity Theory",
    approachTag: "macro",
    thesis: "Developed the theory of 'reflexivity' — market participants' biased perceptions can change fundamentals, creating self-reinforcing boom-bust cycles. Identifies macroeconomic imbalances and policy mistakes, then takes massive leveraged positions at tipping points. Willing to bet enormous sums and reverse instantly when the thesis breaks.",
    keyMetrics: ["Macro policy divergences", "Currency mispricings", "Reflexive feedback loops", "Central bank credibility gaps"],
    famousFor: "'The Man Who Broke the Bank of England' — $1-2B from shorting GBP (1992)",
  },
  "Ray Dalio": {
    name: "Ray Dalio",
    era: "1975 - present",
    peakReturns: "~12% annualized (Pure Alpha, since 1991, only 3-4 losing years)",
    netWorth: "~$20B",
    backstory: "Born in Queens, New York in 1949. Bought his first stock (Northeast Airlines) at age 12 from caddying money. MBA from Harvard. Founded Bridgewater Associates in 1975 from his two-bedroom apartment, growing it into the world's largest hedge fund with $150B+ AUM.",
    approach: "Systematic Global Macro / Risk Parity",
    approachTag: "macro",
    thesis: "Pioneered 'risk parity' — balancing portfolio risk across asset classes rather than by dollar amount. Built systematic models around how the 'economic machine' works through debt cycles, productivity growth, and deleveraging. All Weather provides balanced exposure across growth/inflation regimes.",
    keyMetrics: ["Risk parity across asset classes", "Debt-to-GDP cycle positioning", "Inflation/growth regime ID", "Correlation-adjusted sizing"],
    famousFor: "Built the world's largest hedge fund — 'Principles' for radical transparency",
  },
  "Jesse Livermore": {
    name: "Jesse Livermore",
    era: "1891 - 1940",
    peakReturns: "$100M shorting the 1929 crash (~$1.5B inflation-adjusted)",
    netWorth: "~$100M peak (1929), died insolvent",
    backstory: "Born in Massachusetts in 1877. Ran away from the family farm at 14 to work as a quotation board boy at a Boston brokerage. By 16 was trading full-time at bucket shops. Moved to New York and became one of Wall Street's most famous speculators, making and losing several fortunes.",
    approach: "Momentum / Tape Reading / Trend Following",
    approachTag: "momentum",
    thesis: "Pioneered tape reading and price-action trading. Believed prices move in trends driven by market psychology and patterns repeat because human nature is constant. Used 'pivot points' to identify reversals, only added to winning positions (pyramiding). 'Money is made by sitting, not trading' — patience was his edge.",
    keyMetrics: ["Price breaking pivot points", "Volume confirmation on breakouts", "Trend direction (never fight the tape)", "Pyramiding into winners"],
    famousFor: "The 'Great Bear of Wall Street' — shorted the 1929 crash for $100M",
  },
  "Ed Seykota": {
    name: "Ed Seykota",
    era: "1970s - present",
    peakReturns: "250,000% over 16 years; $5K into $15M in 12 years",
    netWorth: "~$4.2B (estimated)",
    backstory: "Born in 1946. Earned dual B.S. degrees in Electrical Engineering and Management from MIT. Inspired by Donchian's work on trend-following, developed one of the first computerized trading systems using punched-card computers in 1970. Went independent by 23, managing accounts that became legendary.",
    approach: "Systematic Trend Following",
    approachTag: "trend-following",
    thesis: "Pioneered computerized trend-following in futures markets with rules-based systems that removed emotion. Three core rules: cut losses short, ride winners, keep bets small. Believed trading psychology matters more than any system. Merged quantitative rigor with deep self-awareness, treating trading as a mirror for growth.",
    keyMetrics: ["Trend via moving averages", "Risk per trade < 1-2%", "Systematic entry/exit signals", "Favorable risk-reward ratio"],
    famousFor: "Pioneer of computerized trading — one of the greatest trend followers ever",
  },
  "Paul Tudor Jones": {
    name: "Paul Tudor Jones",
    era: "1980 - present",
    peakReturns: "~26% annualized (first 10 years); tripled money in Oct 1987 crash",
    netWorth: "~$8.1B",
    backstory: "Born in Memphis, Tennessee in 1954. Began trading cotton futures in 1976. Founded Tudor Investment Corp in 1980 with $1.5M. Famously predicted and profited from Black Monday 1987, reportedly tripling his money while the market lost 22% in a single day.",
    approach: "Global Macro / Technical Timing",
    approachTag: "macro",
    thesis: "Combines macro-economic analysis with technical pattern recognition and strict risk management. Focuses on identifying major market turning points and asymmetric bets. Famous for the 200-day moving average as a risk management tool. Believes in the importance of capital preservation — 'the most important rule of trading is to play great defense.'",
    keyMetrics: ["200-day moving average", "Risk/reward > 5:1 on conviction trades", "2% max risk per trade", "Macro trend alignment"],
    famousFor: "Predicted and profited from the 1987 crash — 'play great defense'",
  },
  "Howard Marks": {
    name: "Howard Marks",
    era: "1995 - present",
    peakReturns: "~23% gross IRR (Oaktree distressed debt, since 1988)",
    netWorth: "~$2.2B",
    backstory: "Born in New York in 1946. Wharton undergrad, University of Chicago MBA. Spent 16 years at Citibank managing convertible and high-yield portfolios. Co-founded Oaktree Capital Management in 1995, which became the world's largest distressed debt investor with $190B+ AUM.",
    approach: "Contrarian Distressed Debt / Second-Level Thinking",
    approachTag: "contrarian",
    thesis: "Practices 'second-level thinking' — going beyond consensus to find where the market's expectations are wrong. Specializes in buying distressed and undervalued credit when others are panic-selling. Believes market cycles are inevitable and the key is knowing 'where we stand' in the cycle, even if you can't predict what happens next.",
    keyMetrics: ["Credit cycle positioning", "Margin of safety in distressed assets", "Market sentiment extremes", "Risk-adjusted returns vs benchmarks"],
    famousFor: "Legendary investor memos — 'second-level thinking' and market cycles",
  },
  "Philip Fisher": {
    name: "Philip Fisher",
    era: "1931 - 1999",
    peakReturns: "Motorola: held 21 years for ~30x return; numerous multi-baggers",
    netWorth: "~$70M at death (2004)",
    backstory: "Born in San Francisco in 1907. Studied at Stanford Business School. Founded Fisher & Company in 1931 at age 24, during the Great Depression. His son Ken Fisher became a billionaire investor. Buffett credited Fisher with influencing his shift toward quality growth investing.",
    approach: "Quality Growth Investing / Scuttlebutt",
    approachTag: "fundamental",
    thesis: "Pioneered qualitative 'scuttlebutt' research — talking to customers, suppliers, competitors, and employees to evaluate a company's real competitive position. Sought companies with outstanding management, above-average growth potential, and high profit margins that could sustain for decades. Believed in buying and holding for years, rarely selling.",
    keyMetrics: ["Sustainable above-average sales growth", "High profit margins", "Strong R&D spending", "Management integrity & vision"],
    famousFor: "Author of Common Stocks and Uncommon Profits — pioneer of growth investing",
  },
  "William J. O'Neil": {
    name: "William J. O'Neil",
    era: "1960s - 2023",
    peakReturns: "Turned $5K into $200K in 18 months (1962-63); 2,500% in 3 years",
    netWorth: "~$200M",
    backstory: "Born in Oklahoma City in 1933. Began investing while serving in the Air Force. At 30, became the youngest person to buy a seat on the NYSE. Founded Investor's Business Daily (IBD) in 1984 and William O'Neil + Company, a leading institutional research firm.",
    approach: "CAN SLIM Momentum Growth",
    approachTag: "momentum",
    thesis: "Created the CAN SLIM system by studying every major stock market winner from 1880-2009. The system combines fundamental strength (earnings acceleration, new products) with technical timing (buying stocks breaking out of proper chart bases on heavy volume). Stressed cutting losses at 7-8% with no exceptions.",
    keyMetrics: ["Current quarterly EPS growth > 25%", "Annual earnings growth > 25%", "New highs on above-average volume", "7-8% stop loss rule"],
    famousFor: "Creator of CAN SLIM — 'cut losses short, let winners run'",
  },
  "John Maynard Keynes": {
    name: "John Maynard Keynes",
    era: "1920s - 1946",
    peakReturns: "~13.2% annualized (King's College fund, 1927-1946) vs negative UK market",
    netWorth: "~$30M (inflation-adjusted) at death",
    backstory: "Born in Cambridge, England in 1883. Studied mathematics at King's College, Cambridge. Became the most influential economist of the 20th century, reshaping government fiscal policy. Also managed King's College endowment and his own portfolio, evolving from a speculative macro trader to a concentrated value investor.",
    approach: "Concentrated Value / Contrarian",
    approachTag: "contrarian",
    thesis: "Evolved from speculating on currencies and commodities (poorly) to concentrated value investing in stocks he deeply understood. Developed the 'beauty contest' theory of markets — prices reflect what people think others will pay, not intrinsic value. Advocated holding a concentrated portfolio of undervalued stocks through volatility.",
    keyMetrics: ["Intrinsic value vs market price", "Dividend yield", "Concentrated positions (10-15 stocks)", "Long holding periods"],
    famousFor: "'Markets can remain irrational longer than you can remain solvent'",
  },
  "Sir John Templeton": {
    name: "Sir John Templeton",
    era: "1937 - 2000",
    peakReturns: "~15.8% annualized over 38 years (Templeton Growth Fund)",
    netWorth: "~$500M (donated majority to charity)",
    backstory: "Born in Winchester, Tennessee in 1912. Yale graduate, Rhodes Scholar at Oxford. During the 1939 market panic, borrowed $10K to buy 100 shares of every NYSE stock trading under $1 — nearly all recovered. Founded Templeton Growth Fund in 1954, pioneered global investing when others only looked at U.S. stocks.",
    approach: "Global Contrarian Value",
    approachTag: "contrarian",
    thesis: "Sought 'maximum pessimism' — buying in countries and sectors everyone else had written off. Pioneered global diversification, investing in Japan in the 1960s and emerging markets decades before others. Believed the four most dangerous words are 'this time it's different.' Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.",
    keyMetrics: ["P/E below 10 (ideally 5)", "Buying at point of max pessimism", "Global diversification", "5-year holding period minimum"],
    famousFor: "Pioneer of global investing — 'buy at the point of maximum pessimism'",
  },
  "Morgan Housel": {
    name: "Morgan Housel",
    era: "2010s - present",
    peakReturns: "N/A (financial writer/thinker, not fund manager)",
    backstory: "Former columnist at The Motley Fool and The Wall Street Journal. Partner at Collaborative Fund. His 2020 book The Psychology of Money became a global bestseller (5M+ copies), distilling investing wisdom into behavioral psychology insights accessible to everyone.",
    approach: "Behavioral Finance / Long-Term Compounding",
    approachTag: "philosophy",
    thesis: "Argues that financial success has more to do with behavior than intelligence. The most important financial skill is getting the goalpost to stop moving. Emphasizes that compounding works best when you combine patience with consistency, and that 'good enough' returns sustained over decades beat brilliant returns that flame out.",
    keyMetrics: ["Savings rate", "Time in market", "Behavioral consistency", "Tail-event preparedness"],
    famousFor: "Author of The Psychology of Money — 'wealth is what you don't see'",
  },
  "Ken Fisher": {
    name: "Ken Fisher",
    era: "1979 - present",
    peakReturns: "~$175B AUM at Fisher Investments; multiple market-beating decades",
    netWorth: "~$11B",
    backstory: "Born in San Francisco in 1950, son of legendary investor Philip Fisher. Founded Fisher Investments in 1979 from his home in Woodside, California. Became the longest-running Forbes 'Portfolio Strategy' columnist (1984-2017). Built one of the world's largest independent RIAs managing $175B+.",
    approach: "Macro-Driven Equity / Contrarian",
    approachTag: "contrarian",
    thesis: "Focuses on what the majority of investors are getting wrong at any given time. Emphasizes the Price-to-Sales ratio as a better valuation tool than P/E for cyclical earnings. Believes that if everyone expects something, it's already priced in — the market surprises come from what the consensus misses.",
    keyMetrics: ["Price-to-Sales ratio", "Consensus sentiment (contrarian)", "Global sector rotation", "Political/economic surprise factors"],
    famousFor: "'Time in the market beats timing the market'",
  },
  "Alexander Elder": {
    name: "Alexander Elder",
    era: "1980s - present",
    peakReturns: "Consistent profitability over 30+ years (private trading)",
    backstory: "Born in Leningrad (USSR) in 1950. Trained as a psychiatrist, defected from the Soviet Union while working as a ship's doctor in Africa. Moved to New York, practiced psychiatry while learning to trade. Applied psychological insights to trading, writing the landmark Trading for a Living.",
    approach: "Technical Analysis / Trading Psychology",
    approachTag: "technical",
    thesis: "Developed the Triple Screen Trading System — filtering trades through three timeframes (weekly trend, daily signal, intraday entry). Believed most traders fail due to psychology, not methodology. The market doesn't know you exist; you can only control your own behavior. Emphasized disciplined money management and emotional mastery.",
    keyMetrics: ["Triple Screen alignment (3 timeframes)", "Force Index for entry", "2% max risk per trade", "6% max monthly drawdown"],
    famousFor: "Author of Trading for a Living — 'the market does not know you exist'",
  },
  "Nicolas Darvas": {
    name: "Nicolas Darvas",
    era: "1950s - 1960s",
    peakReturns: "Turned $36K into $2.25M in 18 months (1957-58)",
    backstory: "Born in Budapest in 1920. Fled Hungary during WWII, became a world-famous professional dancer touring globally. Started investing while on dance tours, reading financial newspapers by mail. Developed his box theory while traveling, placing trades via telegram from hotels around the world.",
    approach: "Darvas Box / Momentum Breakout",
    approachTag: "momentum",
    thesis: "Created the 'Darvas Box' system — identifying stocks making new highs that consolidate into a rectangular price range (box), then buying when price breaks above the box on increased volume. Combined technical price patterns with fundamental filters (rising earnings). Proved an amateur with discipline could beat the professionals.",
    keyMetrics: ["New 52-week high", "Darvas Box breakout", "Rising earnings trend", "Stop loss at bottom of box"],
    famousFor: "Turned $36K into $2.25M while dancing around the world",
  },
  "Victor Sperandeo": {
    name: "Victor Sperandeo",
    era: "1970s - present",
    peakReturns: "~72% annualized (1978-1989), only one losing year",
    backstory: "Born in New York City in 1945. Grew up in a working-class neighborhood, started as a poker player. Applied probability theory and risk management from poker to trading. Became one of the most consistent traders on Wall Street with a remarkable 18-year streak.",
    approach: "Technical Macro / Probability-Based Trading",
    approachTag: "technical",
    thesis: "Combines macro-economic analysis with technical trend identification. Uses Dow Theory principles to confirm market trends. Focuses on the 1-2-3 trend reversal pattern and 2B test of highs/lows. Stresses that trading success comes from emotional discipline, not intelligence — knowing the odds and managing risk like a poker player.",
    keyMetrics: ["1-2-3 trend change pattern", "2B reversal test", "Dow Theory confirmation", "Risk/reward > 3:1"],
    famousFor: "'Trader Vic' — 'emotional discipline is the key to trading success'",
  },
  "Robert Arnott": {
    name: "Robert Arnott",
    era: "1988 - present",
    peakReturns: "Fundamental Index outperformed cap-weighted by 2%+ annually",
    netWorth: "~$500M",
    backstory: "Born in 1954. Founded Research Affiliates in 2002, pioneering 'fundamental indexing' and 'smart beta' strategies. Former editor of the Financial Analysts Journal. His research on fundamental indexing challenged the efficient market hypothesis and revolutionized passive investing.",
    approach: "Fundamental Indexing / Smart Beta",
    approachTag: "quantitative",
    thesis: "Demonstrated that cap-weighted indexes systematically overweight overpriced stocks and underweight cheap ones. Created fundamental indexes weighted by economic footprint (sales, dividends, book value, cash flow) instead of market cap. This inherent value tilt produces higher returns with similar risk.",
    keyMetrics: ["Fundamental weight (sales, dividends, book value)", "Value tilt vs cap-weight", "Rebalancing alpha", "Long-term risk-adjusted returns"],
    famousFor: "Pioneer of fundamental indexing — 'in investing, what is comfortable is rarely profitable'",
  },
  "Robert Olstein": {
    name: "Robert Olstein",
    era: "1971 - present",
    peakReturns: "~13% annualized (Olstein All Cap Value Fund, long-term)",
    backstory: "Founded Olstein Capital Management in 1995. Known for his forensic accounting approach to finding undervalued companies. Published 'Quality of Earnings' research exposing accounting tricks that hide true company value. Focuses on free cash flow over reported earnings.",
    approach: "Forensic Accounting Value",
    approachTag: "value",
    thesis: "Uses forensic accounting to look beyond reported earnings to find true economic value. Seeks companies where the quality of earnings is high — real free cash flow that's being obscured by conservative accounting or temporarily depressed margins. Believes the market often misprices companies whose true earnings power is hidden.",
    keyMetrics: ["Free cash flow vs reported earnings", "Quality of earnings adjustments", "P/FCF ratio", "Margin recovery potential"],
    famousFor: "'The desire to perform all the time is usually a barrier to performing over time'",
  },
  "Larry Hite": {
    name: "Larry Hite",
    era: "1981 - present",
    peakReturns: "~30% annualized (Mint Investment, 1981-1988)",
    backstory: "Born in New York. Had learning disabilities and poor eyesight growing up. Tried careers as a screenwriter, rock promoter, and actor before finding trading. Co-founded Mint Investment Management in 1981, which became the first commodity fund to manage $1B. Featured in Jack Schwager's Market Wizards.",
    approach: "Systematic Trend Following / Risk Management",
    approachTag: "trend-following",
    thesis: "Focused obsessively on risk management rather than returns. Never risked more than 1% of capital on any single trade. Built systematic trend-following models that removed emotional decision-making. Believed the key to survival is respecting risk — throughout his career he witnessed smart people destroyed by ignoring it.",
    keyMetrics: ["Max 1% risk per trade", "Systematic trend signals", "Diversification across markets", "Strict position sizing"],
    famousFor: "Featured in Market Wizards — 'throughout my career I've seen people ruined by failing to respect risk'",
  },
  "Mellody Hobson": {
    name: "Mellody Hobson",
    era: "2000s - present",
    peakReturns: "Co-CEO of Ariel Investments ($16B+ AUM), strong long-term value returns",
    backstory: "Born in Chicago in 1969, the youngest of six children raised by a single mother. Interned at Ariel Investments during college at Princeton. Rose to become co-CEO and president. Became chair of Starbucks board and a prominent advocate for financial literacy and diversity in finance.",
    approach: "Patient Value / Long-Term Compounding",
    approachTag: "value",
    thesis: "Advocates for patient, long-term value investing focused on small and mid-cap companies with strong fundamentals trading at a discount. Believes financial literacy is the civil rights issue of this generation. Emphasizes that the biggest risk in investing is not taking one — sitting in cash out of fear is the greatest threat to building wealth.",
    keyMetrics: ["Intrinsic value discount", "Small/mid-cap focus", "Long holding periods (3-5+ years)", "Quality management"],
    famousFor: "'The biggest risk of all is not taking one' — advocate for financial literacy",
  },
  "Nassim Nicholas Taleb": {
    name: "Nassim Nicholas Taleb",
    era: "1985 - present",
    peakReturns: "Multi-billion dollar gains from tail-risk hedging (2008 crisis)",
    netWorth: "~$100M+",
    backstory: "Born in Amioun, Lebanon in 1960 to a prominent Greek Orthodox family. Experienced the Lebanese Civil War firsthand. MBA from Wharton, PhD from University of Paris. Worked as a derivatives trader before becoming a scholar of randomness and risk. His Incerto series (Fooled by Randomness, The Black Swan, Antifragile) reshaped how the world thinks about uncertainty.",
    approach: "Tail-Risk Hedging / Antifragility",
    approachTag: "contrarian",
    thesis: "The world is dominated by rare, high-impact 'Black Swan' events that models can't predict. Most risk models dramatically underestimate tail risk. The optimal strategy is to be 'antifragile' — structured to gain from disorder. Keep 85-90% in extremely safe assets (T-bills) and 10-15% in highly speculative bets with unlimited upside (barbell strategy).",
    keyMetrics: ["Tail risk exposure", "Barbell allocation (safe + speculative)", "Convexity of payoffs", "Fragility vs antifragility assessment"],
    famousFor: "Author of The Black Swan — 'the world is dominated by rare events'",
  },
  "Mark Minervini": {
    name: "Mark Minervini",
    era: "1983 - present",
    peakReturns: "220% in a single year; 36,000% cumulative over 5 years; U.S. Investing Champion",
    backstory: "Started trading at 16 with no formal education. Lost money for his first six years. Then developed a systematic approach studying every great stock winner's characteristics. Won the U.S. Investing Championship in 1997 with a 155% return, and again in 2021.",
    approach: "SEPA Momentum / Specific Entry Point Analysis",
    approachTag: "momentum",
    thesis: "Developed the SEPA (Specific Entry Point Analysis) methodology. Only buys stocks in a confirmed Stage 2 uptrend, trading near 52-week highs with accelerating earnings. Focuses on volatility contraction patterns (VCPs) as entry triggers — tight price consolidations that signal institutional accumulation before major moves.",
    keyMetrics: ["Stage 2 uptrend confirmed", "EPS acceleration (current + next quarter)", "Volatility Contraction Pattern (VCP)", "Stop loss 7-8% max"],
    famousFor: "Two-time U.S. Investing Champion — 'superperformance' stock selection",
  },
  "Seneca": {
    name: "Seneca",
    era: "4 BC - 65 AD",
    peakReturns: "N/A (Stoic philosopher, advisor to Emperor Nero)",
    backstory: "Born in Cordoba, Spain. Roman Stoic philosopher, statesman, and dramatist. Served as advisor to Emperor Nero. His writings on adversity, wealth, and the shortness of life have been studied for 2,000 years. Despite being one of Rome's wealthiest citizens, taught that virtue — not wealth — determines quality of life.",
    approach: "Stoic Risk Philosophy",
    approachTag: "philosophy",
    thesis: "Practiced 'premeditatio malorum' — mentally rehearsing worst-case scenarios to reduce their emotional impact. Taught that we suffer more in imagination than reality. For traders: anticipate drawdowns, accept losses as inevitable, and focus only on what you can control (your process, not the market). Wealth is freedom from desire, not accumulation.",
    keyMetrics: ["Emotional detachment from outcomes", "Worst-case preparation", "Process over results", "Focus on controllables"],
    famousFor: "Stoic philosopher — 'we suffer more in imagination than in reality'",
  },
  "Lao Tzu": {
    name: "Lao Tzu",
    era: "~6th century BC",
    peakReturns: "N/A (Taoist philosopher)",
    backstory: "Semi-legendary Chinese philosopher, traditionally credited as author of the Tao Te Ching and founder of Taoism. His teachings on patience, flowing with nature rather than forcing outcomes, and the power of emptiness and non-action (wu wei) have influenced Eastern thought for 2,500 years.",
    approach: "Taoist Patience / Wu Wei",
    approachTag: "philosophy",
    thesis: "Taught 'wu wei' — effortless action, going with the flow rather than forcing outcomes. For traders: don't fight the trend, be patient, let trades come to you. The master trader acts without forcing, leads without controlling. True strength comes from flexibility (like water), not rigidity. Knowing when NOT to trade is as important as knowing when to trade.",
    keyMetrics: ["Patience (wait for setup)", "Non-action (wu wei) when uncertain", "Flexibility over rigidity", "Harmony with market flow"],
    famousFor: "Founder of Taoism — 'nature does not hurry, yet everything is accomplished'",
  },
  "Charles Darwin": {
    name: "Charles Darwin",
    era: "1831 - 1882",
    peakReturns: "N/A (naturalist and evolutionary biologist)",
    backstory: "Born in Shrewsbury, England in 1809. Sailed on the HMS Beagle for five years, observing nature across the globe. Published On the Origin of Species in 1859, establishing evolution by natural selection as the foundational theory of biology. His ideas about adaptation reshaped science forever.",
    approach: "Adaptation / Survival of the Fittest",
    approachTag: "philosophy",
    thesis: "It is not the strongest or most intelligent who survive, but those most adaptable to change. For traders: markets evolve constantly — strategies that worked yesterday may not work tomorrow. The traders who survive are those who adapt their approach to changing market conditions, not those who stubbornly cling to one method.",
    keyMetrics: ["Adaptability to regime change", "Strategy evolution", "Survival over optimization", "Environmental (market) awareness"],
    famousFor: "Theory of evolution — 'it is not the strongest that survive, but the most adaptable'",
  },
  "Benjamin Franklin": {
    name: "Benjamin Franklin",
    era: "1730s - 1790",
    peakReturns: "N/A (polymath, founding father, self-made wealthy from publishing)",
    backstory: "Born in Boston in 1706, the 15th of 17 children. Ran away to Philadelphia at 17 with almost nothing. Built a printing empire, invented the lightning rod, bifocals, and the Franklin stove. Became one of the wealthiest Americans of his era. A founding father who signed the Declaration of Independence.",
    approach: "Practical Wisdom / Compound Discipline",
    approachTag: "philosophy",
    thesis: "Preached that small, consistent habits compound into extraordinary outcomes — 'a penny saved is a penny earned.' Believed in industry, frugality, and self-improvement. For traders: compound returns come from consistent discipline over decades. Avoid get-rich-quick schemes, invest in your own education, and remember that an investment in knowledge pays the best interest.",
    keyMetrics: ["Consistency over brilliance", "Frugality (savings rate)", "Self-education investment", "Long-term compound thinking"],
    famousFor: "'An investment in knowledge pays the best interest'",
  },
  "Albert Einstein": {
    name: "Albert Einstein",
    era: "1905 - 1955",
    peakReturns: "N/A (theoretical physicist, Nobel laureate)",
    backstory: "Born in Ulm, Germany in 1879. Failed to find an academic position after graduating, worked as a patent clerk in Switzerland. While a clerk, published four groundbreaking papers in 1905, including special relativity (E=mc2). Awarded Nobel Prize in Physics in 1921. Fled Nazi Germany for Princeton in 1933.",
    approach: "Simplicity / Power of Compounding",
    approachTag: "philosophy",
    thesis: "Reportedly called compound interest 'the eighth wonder of the world.' Everything should be made as simple as possible, but not simpler. For traders: the most powerful force in investing is compounding over time. Complex strategies often underperform simple ones. Seek elegant simplicity in your approach — understand the fundamentals deeply rather than adding complexity.",
    keyMetrics: ["Compound interest over time", "Simplicity of strategy", "Deep understanding > complex models", "Long time horizons"],
    famousFor: "'Compound interest is the eighth wonder of the world'",
  },
  "Chris Rock": {
    name: "Chris Rock",
    era: "2000s - present",
    peakReturns: "N/A (comedian, cultural commentator on wealth)",
    netWorth: "~$60M",
    backstory: "Born in Andrews, South Carolina in 1965, raised in Brooklyn. Rose from poverty to become one of the most influential comedians of his generation. Known for sharp social commentary including insights on wealth, financial literacy, and the difference between being rich and being wealthy.",
    approach: "Wealth Mindset / Financial Reality",
    approachTag: "philosophy",
    thesis: "Famously distinguished between 'rich' and 'wealthy' — wealth is about generational stability, not flashy spending. Shaq is rich; the white man who signs his check is wealthy. For traders: focus on building lasting wealth through smart decisions, not chasing flashy trades. Real financial security comes from owning assets, not buying liabilities.",
    keyMetrics: ["Wealth vs income distinction", "Generational thinking", "Asset ownership", "Living below means"],
    famousFor: "'Wealth is not about having a lot of money; it's about having a lot of options'",
  },
};

// ─── Book Catalog (30 entries) ───

const CATEGORY_COLORS = {
  psychology: "#4a6670",
  technical: "#7a5c3a",
  fundamentals: "#4a6a52",
  risk: "#6a3a3a",
  philosophy: "#5a4a6a",
} as const;

export const BOOKS: TradingBook[] = [
  {
    id: "trading-in-the-zone",
    title: "Trading in the Zone",
    author: "Mark Douglas",
    tagline: "Master the mental game of trading",
    pullQuote: "The best traders have evolved to the point where they believe that anything can happen at any given moment, and that the unknown is a part of the game.",
    category: "psychology",
    level: "all",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0735201447",
  },
  {
    id: "reminiscences",
    title: "Reminiscences of a Stock Operator",
    author: "Edwin Lefevre",
    tagline: "The timeless classic of market speculation",
    pullQuote: "There is nothing new in Wall Street. There can't be because speculation is as old as the hills. Whatever happens in the stock market today has happened before and will happen again.",
    category: "psychology",
    level: "all",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0471770884",
  },
  {
    id: "market-wizards",
    title: "Market Wizards",
    author: "Jack D. Schwager",
    tagline: "Interviews with top traders reveal their secrets",
    pullQuote: "I always laugh at people who say, 'I've never met a rich technician.' I love that! It's such an arrogant, nonsensical response.",
    category: "psychology",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "1118273052",
  },
  {
    id: "intelligent-investor",
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    tagline: "The definitive book on value investing",
    pullQuote: "The investor's chief problem, and even his worst enemy, is likely to be himself. In the end, how your investments behave is much less important than how you behave.",
    category: "fundamentals",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.fundamentals,
    isbn: "0060555661",
  },
  {
    id: "thinking-fast-slow",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    tagline: "How two systems of thought shape our decisions",
    pullQuote: "A reliable way to make people believe in falsehoods is frequent repetition, because familiarity is not easily distinguished from truth.",
    category: "psychology",
    level: "all",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0374533555",
  },
  {
    id: "alchemy-of-finance",
    title: "The Alchemy of Finance",
    author: "George Soros",
    tagline: "Reflexivity and the art of speculation",
    pullQuote: "It is not whether you are right or wrong that is important, but how much money you make when you are right and how much you lose when you are wrong.",
    category: "philosophy",
    level: "advanced",
    coverAccent: CATEGORY_COLORS.philosophy,
    isbn: "0471445495",
  },
  {
    id: "tech-analysis-financial-markets",
    title: "Technical Analysis of the Financial Markets",
    author: "John J. Murphy",
    tagline: "The comprehensive guide to trading methods",
    pullQuote: "Technical analysis is the study of market action, primarily through the use of charts, for the purpose of forecasting future price trends.",
    category: "technical",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "0735200661",
  },
  {
    id: "fooled-by-randomness",
    title: "Fooled by Randomness",
    author: "Nassim Nicholas Taleb",
    tagline: "The hidden role of chance in life and markets",
    pullQuote: "Mild success can be explainable by skills and labor. Wild success is attributable to variance.",
    category: "risk",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.risk,
    isbn: "0812975219",
  },
  {
    id: "man-who-solved-market",
    title: "The Man Who Solved the Market",
    author: "Gregory Zuckerman",
    tagline: "How Jim Simons launched the quant revolution",
    pullQuote: "Past performance is the best predictor of future success. Not a great predictor, but the best one we have.",
    category: "fundamentals",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.fundamentals,
    isbn: "073521798X",
  },
  {
    id: "psychology-of-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    tagline: "Timeless lessons on wealth, greed, and happiness",
    pullQuote: "Doing well with money has a little to do with how smart you are and a lot to do with how you behave.",
    category: "psychology",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0857197681",
  },
  {
    id: "principles",
    title: "Principles",
    author: "Ray Dalio",
    tagline: "Life and work principles from a legendary investor",
    pullQuote: "Pain plus reflection equals progress. The quality of your life depends on the quality of your decisions.",
    category: "philosophy",
    level: "all",
    coverAccent: CATEGORY_COLORS.philosophy,
    isbn: "1501124021",
  },
  {
    id: "one-up-on-wall-street",
    title: "One Up on Wall Street",
    author: "Peter Lynch",
    tagline: "How to use what you already know to profit",
    pullQuote: "Know what you own, and know why you own it. If you can't explain it in two minutes or less to a ten-year-old, don't own it.",
    category: "fundamentals",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.fundamentals,
    isbn: "0743200403",
  },
  {
    id: "black-swan",
    title: "The Black Swan",
    author: "Nassim Nicholas Taleb",
    tagline: "The impact of the highly improbable",
    pullQuote: "The inability to predict outliers implies the inability to predict the course of history. But we act as though we are able to predict it.",
    category: "risk",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.risk,
    isbn: "081297381X",
  },
  {
    id: "mastering-market-cycle",
    title: "Mastering the Market Cycle",
    author: "Howard Marks",
    tagline: "Getting the odds on your side",
    pullQuote: "We may never know where we're going, but we'd better have a good idea where we are. That is, even if we can't predict, we can prepare.",
    category: "fundamentals",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.fundamentals,
    isbn: "1328479250",
  },
  {
    id: "most-important-thing",
    title: "The Most Important Thing",
    author: "Howard Marks",
    tagline: "Uncommon sense for the thoughtful investor",
    pullQuote: "The biggest investing errors come not from factors that are informational or analytical, but from those that are psychological.",
    category: "philosophy",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.philosophy,
    isbn: "0231153686",
  },
  {
    id: "japanese-candlestick",
    title: "Japanese Candlestick Charting Techniques",
    author: "Steve Nison",
    tagline: "The definitive guide to candlestick patterns",
    pullQuote: "Candlestick charts are not just a different method to display data. They are also a window into the psychology of trading.",
    category: "technical",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "0735201811",
  },
  {
    id: "quantitative-trading",
    title: "Quantitative Trading",
    author: "Ernest P. Chan",
    tagline: "How to build your own algorithmic business",
    pullQuote: "The first thing a quantitative trader needs to learn is the difference between a backtest and a live trading result.",
    category: "technical",
    level: "advanced",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "1119800064",
  },
  {
    id: "disciplined-trader",
    title: "The Disciplined Trader",
    author: "Mark Douglas",
    tagline: "Developing winning attitudes in the market",
    pullQuote: "The tools you will use to create this new version of yourself are your willingness and desire to learn, fueled by your passion to be successful.",
    category: "psychology",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0132157578",
  },
  {
    id: "trade-like-stock-market-wizard",
    title: "Trade Like a Stock Market Wizard",
    author: "Mark Minervini",
    tagline: "How to achieve super performance in stocks",
    pullQuote: "The secret is to learn from your mistakes and not repeat them. Every great stock market winner started by being wrong.",
    category: "technical",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "0071807225",
  },
  {
    id: "flash-boys",
    title: "Flash Boys",
    author: "Michael Lewis",
    tagline: "A Wall Street revolt against high-frequency trading",
    pullQuote: "The stock market is rigged. Not by a cabal of insiders, but by a system designed to give certain traders an edge over ordinary investors.",
    category: "fundamentals",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.fundamentals,
    isbn: "0393351599",
  },
  {
    id: "market-mind-games",
    title: "Market Mind Games",
    author: "Denise Shull",
    tagline: "A radical psychology of investing and risk",
    pullQuote: "Feelings, properly identified and leveraged, provide the missing edge in trading that no algorithm can replicate.",
    category: "psychology",
    level: "advanced",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0071756221",
  },
  {
    id: "new-market-wizards",
    title: "The New Market Wizards",
    author: "Jack D. Schwager",
    tagline: "Conversations with America's top traders",
    pullQuote: "There is no single market secret to discover, no correct way to trade the markets. Those searching for the one true answer to the markets haven't even gotten as far as asking the right question.",
    category: "psychology",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0887306675",
  },
  {
    id: "anti-fragile",
    title: "Antifragile",
    author: "Nassim Nicholas Taleb",
    tagline: "Things that gain from disorder",
    pullQuote: "Wind extinguishes a candle and energizes fire. Likewise with randomness, uncertainty, chaos: you want to use them, not hide from them.",
    category: "risk",
    level: "advanced",
    coverAccent: CATEGORY_COLORS.risk,
    isbn: "0812979680",
  },
  {
    id: "way-of-the-turtle",
    title: "Way of the Turtle",
    author: "Curtis Faith",
    tagline: "The secret methods of legendary traders",
    pullQuote: "Trading with an edge is what separates the professionals from the amateurs. Ignore this and the markets will be happy to relieve you of your money.",
    category: "technical",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "007148664X",
  },
  {
    id: "pit-bull",
    title: "Pit Bull",
    author: "Martin Schwartz",
    tagline: "Lessons from Wall Street's champion trader",
    pullQuote: "I always took my losses quickly. That's the key to success. You have to learn to take losses. The most important thing in making money is not letting your losses get out of hand.",
    category: "psychology",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0887309569",
  },
  {
    id: "when-genius-failed",
    title: "When Genius Failed",
    author: "Roger Lowenstein",
    tagline: "The rise and fall of Long-Term Capital Management",
    pullQuote: "Models could tell you what would happen in normal times. But they could not predict the unforeseeable, and it was precisely the unforeseeable that defined a crisis.",
    category: "risk",
    level: "intermediate",
    coverAccent: CATEGORY_COLORS.risk,
    isbn: "0375758259",
  },
  {
    id: "education-of-a-speculator",
    title: "The Education of a Speculator",
    author: "Victor Niederhoffer",
    tagline: "A maverick trader's unconventional wisdom",
    pullQuote: "The speculator's job is to buy low and sell high, or sell high and buy low. That simple mission conceals endless complexity.",
    category: "philosophy",
    level: "advanced",
    coverAccent: CATEGORY_COLORS.philosophy,
    isbn: "0471249483",
  },
  {
    id: "stock-traders-almanac",
    title: "Stock Trader's Almanac",
    author: "Jeffrey A. Hirsch",
    tagline: "Seasonal tendencies and historical patterns",
    pullQuote: "History doesn't repeat itself, but it does rhyme. Seasonal patterns persist because human behavior is cyclical.",
    category: "technical",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.technical,
    isbn: "1118659724",
  },
  {
    id: "skin-in-the-game",
    title: "Skin in the Game",
    author: "Nassim Nicholas Taleb",
    tagline: "Hidden asymmetries in daily life",
    pullQuote: "Don't tell me what you think, tell me what you have in your portfolio. Never trust anyone who doesn't have skin in the game.",
    category: "philosophy",
    level: "all",
    coverAccent: CATEGORY_COLORS.philosophy,
    isbn: "042528462X",
  },
  {
    id: "trading-for-a-living",
    title: "Trading for a Living",
    author: "Alexander Elder",
    tagline: "Psychology, tactics, and money management",
    pullQuote: "The goal of a successful trader is to make the best trades. Money is secondary. If you are surprised by this, think about how the best professionals in any field operate.",
    category: "psychology",
    level: "beginner",
    coverAccent: CATEGORY_COLORS.psychology,
    isbn: "0471592242",
  },
];

// ─── Quote Catalog (50 entries) ───

export const QUOTES: TradingQuote[] = [
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett", category: "mindset" },
  { text: "Markets can remain irrational longer than you can remain solvent.", author: "John Maynard Keynes", category: "risk" },
  { text: "The four most dangerous words in investing are: 'This time it's different.'", author: "Sir John Templeton", category: "risk" },
  { text: "Know what you own, and know why you own it.", author: "Peter Lynch", category: "strategy" },
  { text: "Risk comes from not knowing what you are doing.", author: "Warren Buffett", category: "risk" },
  { text: "The trend is your friend until the end when it bends.", author: "Ed Seykota", category: "strategy" },
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder", category: "mindset" },
  { text: "The market is a pendulum that forever swings between unsustainable optimism and unjustified pessimism.", author: "Benjamin Graham", category: "mindset" },
  { text: "Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.", author: "Warren Buffett", category: "strategy" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "George Soros", category: "risk" },
  { text: "The whole secret to winning big in the stock market is not to be right all the time, but to lose the least amount possible when you're wrong.", author: "William J. O'Neil", category: "risk" },
  { text: "Be fearful when others are greedy, and greedy when others are fearful.", author: "Warren Buffett", category: "strategy" },
  { text: "The biggest risk of all is not taking one.", author: "Mellody Hobson", category: "risk" },
  { text: "The individual investor should act consistently as an investor and not as a speculator.", author: "Benjamin Graham", category: "discipline" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", author: "Warren Buffett", category: "strategy" },
  { text: "Pain plus reflection equals progress.", author: "Ray Dalio", source: "Principles", category: "mindset" },
  { text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.", author: "Warren Buffett", category: "strategy" },
  { text: "If you don't find a way to make money while you sleep, you will work until you die.", author: "Warren Buffett", category: "wisdom" },
  { text: "The most important quality for an investor is temperament, not intellect.", author: "Warren Buffett", category: "mindset" },
  { text: "Win or lose, everybody gets what they want out of the market. Some people seem to like to lose, so they win by losing money.", author: "Ed Seykota", category: "mindset" },
  { text: "There is a time for everything. A time to go long, a time to go short, and a time to go fishing.", author: "Jesse Livermore", category: "strategy" },
  { text: "Never invest in a business you cannot understand.", author: "Warren Buffett", category: "strategy" },
  { text: "You get recessions, you have stock market declines. If you don't understand that's going to happen, then you're not ready and you won't do well in the markets.", author: "Peter Lynch", category: "risk" },
  { text: "The elements of good trading are: cutting losses, cutting losses, and cutting losses.", author: "Ed Seykota", category: "risk" },
  { text: "Money is just a way of keeping score. The real thrill is in the doing.", author: "Paul Tudor Jones", category: "mindset" },
  { text: "It takes twenty years to build a reputation and five minutes to ruin it. If you think about that, you'll do things differently.", author: "Warren Buffett", category: "wisdom" },
  { text: "The stock market is filled with individuals who know the price of everything, but the value of nothing.", author: "Philip Fisher", category: "wisdom" },
  { text: "Successful investing is about managing risk, not avoiding it.", author: "Benjamin Graham", category: "risk" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "Robert Arnott", category: "mindset" },
  { text: "The key to trading success is emotional discipline. Making money has nothing to do with intelligence.", author: "Victor Sperandeo", category: "discipline" },
  { text: "The desire to perform all the time is usually a barrier to performing over time.", author: "Robert Olstein", category: "discipline" },
  { text: "Time in the market beats timing the market.", author: "Ken Fisher", category: "strategy" },
  { text: "Throughout my financial career, I have continually witnessed examples of other people that I have known being ruined by a failure to respect risk.", author: "Larry Hite", category: "risk" },
  { text: "I believe in analysis and not forecasting.", author: "Nicolas Darvas", category: "strategy" },
  { text: "The secret of my success is that I always try to find the price at which something is too cheap to sell.", author: "Charlie Munger", category: "strategy" },
  { text: "He who lives by the crystal ball will eat shattered glass.", author: "Ray Dalio", category: "risk" },
  { text: "The biggest mistake investors make is to believe that what happened in the recent past is likely to persist.", author: "Howard Marks", category: "mindset" },
  { text: "Good investing is not necessarily about making good decisions. It's about consistently not screwing up.", author: "Morgan Housel", category: "discipline" },
  { text: "There is nothing new in Wall Street. There can't be because speculation is as old as the hills.", author: "Jesse Livermore", category: "wisdom" },
  { text: "The market does not know you exist. You can do nothing to influence it. You can only control your behavior.", author: "Alexander Elder", category: "discipline" },
];

// ─── Helper Functions ───

/** Deterministic hash from date string for pseudo-random selection */
export function dateSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/** Get today's date string in YYYY-MM-DD format */
function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns a featured book and 3 secondary books, deterministic by date, filtered by experience level */
export function getDailyBooks(experience: string = "all"): {
  featured: TradingBook;
  secondary: TradingBook[];
} {
  const seed = dateSeed(todayStr());

  const levelMap: Record<string, string[]> = {
    beginner: ["beginner", "all"],
    intermediate: ["beginner", "intermediate", "all"],
    advanced: ["beginner", "intermediate", "advanced", "all"],
    all: ["beginner", "intermediate", "advanced", "all"],
  };
  const eligible = levelMap[experience] || levelMap.all;
  const filtered = BOOKS.filter((b) => eligible.includes(b.level));
  const pool = filtered.length >= 4 ? filtered : BOOKS;

  const indices = pool.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (seed * (i + 1) + 7919) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return {
    featured: pool[indices[0]],
    secondary: [pool[indices[1]], pool[indices[2]], pool[indices[3]]],
  };
}

/** Get the current quote index based on today's date */
export function getDailyQuoteIndex(): number {
  return dateSeed(todayStr()) % QUOTES.length;
}

/** Get a quote at a given offset from the daily base index */
export function getQuoteAtOffset(offset: number): TradingQuote {
  const base = getDailyQuoteIndex();
  return QUOTES[(base + offset) % QUOTES.length];
}

/** Returns the current global market session */
export function getMarketSession(): { label: string; isOpen: boolean } {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const t = utcH * 60 + utcM;

  if (t >= 0 && t < 360) return { label: "Tokyo Session", isOpen: true };
  if (t >= 480 && t < 990) return { label: "London Session", isOpen: true };
  if (t >= 870 && t < 1260) return { label: "New York Session", isOpen: true };
  if (t >= 870 && t < 990) return { label: "London / New York", isOpen: true };

  return { label: "Markets Closed", isOpen: false };
}

/** Returns a time-appropriate greeting */
export function getTimeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Returns a nicely formatted date string like "Monday, February 24, 2026" */
export function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Open Library cover URL by ISBN */
export function getBookCoverUrl(isbn: string, size: "S" | "M" | "L" = "M"): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

/** Deterministic accent color for an author name */
export function authorAccentColor(name: string): string {
  const palette = ["#4a6670", "#7a5c3a", "#4a6a52", "#6a3a3a", "#5a4a6a", "#5a6a4a", "#6a5a3a"];
  return palette[dateSeed(name) % palette.length];
}

// ─── Author Headshots (local files from scripts/download_headshots.py) ───

/** Slug for local headshot filename (matches scripts/download_headshots.py) */
function headshotSlug(name: string): string {
  return name.replace(/[.'']/g, "").replace(/\s+/g, "-").toLowerCase();
}

/** Get headshot URL: local /headshots/ (PNG from browser screenshots or JPG from download script) */
export function getAuthorHeadshotUrl(author: string): string | undefined {
  const slug = headshotSlug(author);
  return `/headshots/${slug}.png`; // Try PNG first (browser screenshots), fallback to .jpg in public
}
