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

export interface TradingQuote {
  text: string;
  author: string;
  source?: string;
}

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
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "It is not the strongest of the species that survives, nor the most intelligent. It is the one most adaptable to change.", author: "Charles Darwin" },
  { text: "Markets can remain irrational longer than you can remain solvent.", author: "John Maynard Keynes" },
  { text: "The four most dangerous words in investing are: 'This time it's different.'", author: "Sir John Templeton" },
  { text: "Know what you own, and know why you own it.", author: "Peter Lynch" },
  { text: "Risk comes from not knowing what you are doing.", author: "Warren Buffett" },
  { text: "The trend is your friend until the end when it bends.", author: "Ed Seykota" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "Robert Arnott" },
  { text: "The key to trading success is emotional discipline. Making money has nothing to do with intelligence.", author: "Victor Sperandeo" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "Compound interest is the eighth wonder of the world. He who understands it, earns it. He who doesn't, pays it.", author: "Albert Einstein" },
  { text: "The market is a pendulum that forever swings between unsustainable optimism and unjustified pessimism.", author: "Benjamin Graham" },
  { text: "Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.", author: "Warren Buffett" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "George Soros" },
  { text: "The desire to perform all the time is usually a barrier to performing over time.", author: "Robert Olstein" },
  { text: "The whole secret to winning big in the stock market is not to be right all the time, but to lose the least amount possible when you're wrong.", author: "William J. O'Neil" },
  { text: "Time in the market beats timing the market.", author: "Ken Fisher" },
  { text: "Be fearful when others are greedy, and greedy when others are fearful.", author: "Warren Buffett" },
  { text: "The biggest risk of all is not taking one.", author: "Mellody Hobson" },
  { text: "Wealth is not about having a lot of money; it's about having a lot of options.", author: "Chris Rock" },
  { text: "Every battle is won or lost before it is ever fought.", author: "Sun Tzu", source: "The Art of War" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Lao Tzu" },
  { text: "Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power.", author: "Lao Tzu", source: "Tao Te Ching" },
  { text: "The individual investor should act consistently as an investor and not as a speculator.", author: "Benjamin Graham" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", author: "Warren Buffett" },
  { text: "Pain plus reflection equals progress.", author: "Ray Dalio", source: "Principles" },
  { text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.", author: "Warren Buffett" },
  { text: "If you don't find a way to make money while you sleep, you will work until you die.", author: "Warren Buffett" },
  { text: "The most important quality for an investor is temperament, not intellect.", author: "Warren Buffett" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The harder I work, the luckier I get.", author: "Gary Player" },
  { text: "Win or lose, everybody gets what they want out of the market. Some people seem to like to lose, so they win by losing money.", author: "Ed Seykota" },
  { text: "There is a time for everything. A time to go long, a time to go short, and a time to go fishing.", author: "Jesse Livermore" },
  { text: "Never invest in a business you cannot understand.", author: "Warren Buffett" },
  { text: "The only thing we have to fear is fear itself.", author: "Franklin D. Roosevelt" },
  { text: "Throughout my financial career, I have continually witnessed examples of other people that I have known being ruined by a failure to respect risk.", author: "Larry Hite" },
  { text: "You get recessions, you have stock market declines. If you don't understand that's going to happen, then you're not ready and you won't do well in the markets.", author: "Peter Lynch" },
  { text: "The elements of good trading are: cutting losses, cutting losses, and cutting losses.", author: "Ed Seykota" },
  { text: "I believe in analysis and not forecasting.", author: "Nicolas Darvas" },
  { text: "Money is just a way of keeping score. The real thrill is in the doing.", author: "Paul Tudor Jones" },
  { text: "It takes twenty years to build a reputation and five minutes to ruin it. If you think about that, you'll do things differently.", author: "Warren Buffett" },
  { text: "The stock market is filled with individuals who know the price of everything, but the value of nothing.", author: "Philip Fisher" },
  { text: "Successful investing is about managing risk, not avoiding it.", author: "Benjamin Graham" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
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

// ─── Author Headshots (Wikimedia Commons thumbnails) ───

const AUTHOR_HEADSHOTS: Record<string, string> = {
  "Warren Buffett": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Warren_Buffett_KU_Visit.jpg/220px-Warren_Buffett_KU_Visit.jpg",
  "Jesse Livermore": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Jesse_Livermore_boyish_look.jpg/220px-Jesse_Livermore_boyish_look.jpg",
  "George Soros": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/George_Soros_-_Festival_Economia_2012.JPG/220px-George_Soros_-_Festival_Economia_2012.JPG",
  "Charlie Munger": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Charlie_Munger_%28cropped%29.jpg/220px-Charlie_Munger_%28cropped%29.jpg",
  "Peter Lynch": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Peter_Lynch_-_Dies_Academicus_2007.jpg/220px-Peter_Lynch_-_Dies_Academicus_2007.jpg",
  "Ray Dalio": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Ray_Dalio_2017.jpg/220px-Ray_Dalio_2017.jpg",
  "Howard Marks": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Howard_Marks_headshot.jpg/220px-Howard_Marks_headshot.jpg",
  "Nassim Nicholas Taleb": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Taleb_muse.JPG/220px-Taleb_muse.JPG",
  "Paul Tudor Jones": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Paul_Tudor_Jones_hedge_fund_manager.jpg/220px-Paul_Tudor_Jones_hedge_fund_manager.jpg",
  "Ed Seykota": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ed_Seykota.jpg/220px-Ed_Seykota.jpg",
  "Alexander Elder": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Alexander_Elder.jpg/220px-Alexander_Elder.jpg",
  "Benjamin Graham": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg/220px-Benjamin_Graham_%281894-1976%29_portrait_on_23_March_1950.jpg",
  "John Maynard Keynes": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/John_Maynard_Keynes.jpg/220px-John_Maynard_Keynes.jpg",
  "Sir John Templeton": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/John_Templeton.jpg/220px-John_Templeton.jpg",
  "Philip Fisher": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Philip_A._Fisher.jpg/220px-Philip_A._Fisher.jpg",
  "Stanley Druckenmiller": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Stanley_Druckenmiller.jpg/220px-Stanley_Druckenmiller.jpg",
  "Jim Simons": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/James_Harris_Simons.jpg/220px-James_Harris_Simons.jpg",
  "Morgan Housel": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Morgan_Housel_2021.jpg/220px-Morgan_Housel_2021.jpg",
  "Mark Douglas": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a5/Mark_Douglas_trader.jpg/220px-Mark_Douglas_trader.jpg",
  "William J. O'Neil": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/William_O%27Neil.jpg/220px-William_O%27Neil.jpg",
  "Marcus Aurelius": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/MSR-ra-61-b-1-DM.jpg/220px-MSR-ra-61-b-1-DM.jpg",
  "Seneca": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Seneca-berlinantikensammlung-1.jpg/220px-Seneca-berlinantikensammlung-1.jpg",
  "Epictetus": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Epicteti_Enchiridion_Latinis_versibus_adumbratum_%28Oxford_1715%29_frontispiece.jpg/220px-Epicteti_Enchiridion_Latinis_versibus_adumbratum_%28Oxford_1715%29_frontispiece.jpg",
  "Sun Tzu": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Erta_Sun_Tzu.jpg/220px-Erta_Sun_Tzu.jpg",
  "Lao Tzu": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Laozi_002.jpg/220px-Laozi_002.jpg",
  "Benjamin Franklin": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Joseph_Siffrein_Duplessis_-_Benjamin_Franklin_-_Google_Art_Project.jpg/220px-Joseph_Siffrein_Duplessis_-_Benjamin_Franklin_-_Google_Art_Project.jpg",
  "Albert Einstein": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/220px-Albert_Einstein_Head.jpg",
  "Confucius": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Konfuzius-1770.jpg/220px-Konfuzius-1770.jpg",
};

/** Get a Wikimedia Commons headshot URL for a quote author */
export function getAuthorHeadshotUrl(author: string): string | undefined {
  return AUTHOR_HEADSHOTS[author];
}
