/**
 * Static array of productivity-focused affirmations and motivational quotes
 * Deterministically selected per calendar day with interactive cycling.
 */

export interface DailyQuote {
  quote: string;
  author: string;
  tag: string;
}

export const PRODUCTIVITY_QUOTES: DailyQuote[] = [
  {
    quote: "You do not rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
    tag: "Systems & Habits",
  },
  {
    quote: "Clarity about what matters provides clarity about what does not.",
    author: "Cal Newport",
    tag: "Deep Focus",
  },
  {
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Will Durant (on Aristotle)",
    tag: "Consistency",
  },
  {
    quote: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma",
    tag: "Momentum",
  },
  {
    quote: "Focus is a muscle. The more you protect your attention, the stronger your mind becomes.",
    author: "Deep Work Affirmation",
    tag: "Mindset",
  },
  {
    quote: "Action isn't just the effect of motivation; it's also the cause of it.",
    author: "Mark Manson",
    tag: "Initiative",
  },
  {
    quote: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.",
    author: "Alexander Graham Bell",
    tag: "Singular Focus",
  },
  {
    quote: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca",
    tag: "Time Discipline",
  },
  {
    quote: "Do today what others won't, so tomorrow you can do what others can't.",
    author: "Jerry Rice",
    tag: "Dedication",
  },
  {
    quote: "Simplicity boils down to two steps: Identify the essential. Eliminate the rest.",
    author: "Leo Babauta",
    tag: "Clarity",
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    tag: "Start Today",
  },
  {
    quote: "Energy flows where attention goes. Guard your hours like your most precious asset.",
    author: "Productivity Principle",
    tag: "Attention",
  },
  {
    quote: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.",
    author: "Stephen King",
    tag: "Professionalism",
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
    tag: "Persistence",
  },
  {
    quote: "Until we can manage time, we can manage nothing else.",
    author: "Peter Drucker",
    tag: "Priorities",
  },
  {
    quote: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
    tag: "Self-Control",
  },
  {
    quote: "One hour of unbroken concentration produces more value than eight hours of distracted effort.",
    author: "Focus Affirmation",
    tag: "Deep Work",
  },
  {
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    tag: "Resilience",
  },
  {
    quote: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
    tag: "Action",
  },
  {
    quote: "Productivity is never an accident. It is always the result of a commitment to excellence and focused effort.",
    author: "Paul J. Meyer",
    tag: "Excellence",
  },
  {
    quote: "Today's discipline builds tomorrow's freedom. Win the morning, win the day.",
    author: "Daily Affirmation",
    tag: "Morning Mindset",
  },
  {
    quote: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    tag: "Patience",
  },
  {
    quote: "Your future is created by what you do today, not tomorrow.",
    author: "Robert Kiyosaki",
    tag: "Present Focus",
  },
  {
    quote: "Decide what to do, then do only that. Half-hearted work is twice the effort.",
    author: "Focus Principle",
    tag: "Single-Tasking",
  },
  {
    quote: "Great acts are made up of small deeds.",
    author: "Lao Tzu",
    tag: "Execution",
  },
  {
    quote: "Either you run the day, or the day runs you.",
    author: "Jim Rohn",
    tag: "Ownership",
  },
  {
    quote: "Consistency is what transforms average into excellence.",
    author: "Habit Maxim",
    tag: "Consistency",
  },
  {
    quote: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    tag: "Purpose",
  },
  {
    quote: "Be like water: adaptable, persistent, and carving paths through rock by sheer consistency.",
    author: "Bruce Lee",
    tag: "Adaptability",
  },
  {
    quote: "Make each day your masterpiece. Today's checklist is your blueprint for progress.",
    author: "John Wooden",
    tag: "Daily Masterpiece",
  },
  {
    quote: "Every master was once a beginner. Keep showing up, one focused session at a time.",
    author: "Growth Mindset",
    tag: "Growth",
  },
];

/**
 * Returns a deterministic quote for a given date key (YYYY-MM-DD).
 * The offset parameter allows manual cycling through other quotes on the same day.
 */
export function getQuoteForDate(dateStr: string, offset: number = 0): DailyQuote {
  if (!dateStr) return PRODUCTIVITY_QUOTES[0];
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash + offset) % PRODUCTIVITY_QUOTES.length;
  return PRODUCTIVITY_QUOTES[index];
}
