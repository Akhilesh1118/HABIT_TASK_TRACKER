import React, { useState, useMemo, useCallback } from 'react';
import { Quote, RotateCw, Sparkles } from 'lucide-react';
import { storageService } from '../services/storageService';
import { getCurrentIST } from '../utils/timeUtils';

export interface DailyQuoteItem {
  id: string;
  text: string;
  author: string;
  category: string;
}

export const DAILY_QUOTES: DailyQuoteItem[] = [
  {
    id: 'q1',
    text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    author: 'James Clear',
    category: 'Atomic Habits',
  },
  {
    id: 'q2',
    text: 'Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.',
    author: 'John C. Maxwell',
    category: 'Consistency',
  },
  {
    id: 'q3',
    text: 'Arise, awake, and stop not until the goal is reached.',
    author: 'Swami Vivekananda',
    category: 'Focus & Purpose',
  },
  {
    id: 'q4',
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Will Durant (on Aristotle)',
    category: 'Excellence',
  },
  {
    id: 'q5',
    text: 'To shine like the sun, you must first burn like the sun.',
    author: 'Dr. A.P.J. Abdul Kalam',
    category: 'Perseverance',
  },
  {
    id: 'q6',
    text: "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success.",
    author: 'Dwayne Johnson',
    category: 'Hard Work',
  },
  {
    id: 'q7',
    text: 'Cultivate an indomitable will; education is the milk of a tigress, and he who drinks it will roar.',
    author: 'Dr. B.R. Ambedkar',
    category: 'Knowledge & Strength',
  },
  {
    id: 'q8',
    text: 'Focus is a muscle. The more you protect your deep work blocks from distraction, the stronger it becomes.',
    author: 'Cal Newport',
    category: 'Deep Work',
  },
  {
    id: 'q9',
    text: 'Do what you can, with what you have, where you are.',
    author: 'Theodore Roosevelt',
    category: 'Action',
  },
  {
    id: 'q10',
    text: 'Action is the foundational key to all success. Even 25 focused minutes today moves the needle.',
    author: 'Pablo Picasso',
    category: 'Execution',
  },
  {
    id: 'q11',
    text: 'The secret of getting ahead is getting started. The secret of getting started is breaking complex overwhelming tasks into manageable actions.',
    author: 'Mark Twain',
    category: 'Daily Progress',
  },
  {
    id: 'q12',
    text: 'It does not matter how slowly you go as long as you do not stop.',
    author: 'Confucius',
    category: 'Persistence',
  },
  {
    id: 'q13',
    text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
    author: 'Alexander Graham Bell',
    category: 'Deep Focus',
  },
  {
    id: 'q14',
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
    category: 'Self-Discipline',
  },
  {
    id: 'q15',
    text: 'Your daily habits will either build you or break you. Choose every study hour with intention.',
    author: 'Marcus Aurelius',
    category: 'Mindset',
  },
];

export function getTimeOfDayGreeting(hours?: number): { greeting: string; icon: string } {
  const currentHour = typeof hours === 'number' ? hours : getCurrentIST().hours;
  if (currentHour >= 5 && currentHour < 12) {
    return { greeting: 'Good Morning', icon: '🌅' };
  } else if (currentHour >= 12 && currentHour < 17) {
    return { greeting: 'Good Afternoon', icon: '☀️' };
  } else if (currentHour >= 17 && currentHour < 21) {
    return { greeting: 'Good Evening', icon: '🌆' };
  } else {
    return { greeting: 'Good Evening', icon: '🌙' };
  }
}

interface QuoteCardProps {
  selectedDate?: string;
  userName?: string;
  className?: string;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({ selectedDate, userName, className = '' }) => {
  // Deterministic seed based on selected date
  const defaultIndex = useMemo(() => {
    if (!selectedDate) return 0;
    let hash = 0;
    for (let i = 0; i < selectedDate.length; i++) {
      hash = (hash << 5) - hash + selectedDate.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % DAILY_QUOTES.length;
  }, [selectedDate]);

  const [currentIndex, setCurrentIndex] = useState(defaultIndex);
  const [isSpinning, setIsSpinning] = useState(false);

  const timeGreeting = useMemo(() => getTimeOfDayGreeting(), []);

  const resolvedName = useMemo(() => {
    if (userName && userName.trim() && userName !== 'Student' && userName !== 'User') {
      return userName.trim().split(' ')[0];
    }
    const user = storageService.getUser();
    if (user.name && user.name.trim() && user.name !== 'Student' && user.name !== 'User') {
      return user.name.trim().split(' ')[0];
    }
    if (user.email && user.email !== 'user@example.com') {
      const prefix = user.email.split('@')[0];
      const cleaned = prefix.replace(/[0-9_.-]/g, '');
      if (cleaned.length >= 2) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }
    return '';
  }, [userName]);

  // Sync index when selected date changes unless user already interacted
  const [userInteractedDate, setUserInteractedDate] = useState<string | null>(null);
  React.useEffect(() => {
    if (userInteractedDate !== selectedDate) {
      setCurrentIndex(defaultIndex);
    }
  }, [selectedDate, defaultIndex, userInteractedDate]);

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    setUserInteractedDate(selectedDate || 'today');
    setCurrentIndex((prev) => (prev + 1) % DAILY_QUOTES.length);
    setTimeout(() => {
      setIsSpinning(false);
    }, 500);
  }, [selectedDate]);

  const currentQuote = DAILY_QUOTES[currentIndex] || DAILY_QUOTES[0];

  return (
    <div
      id="daily-quote-card"
      data-testid="quote-card"
      className={`quote-card relative overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-700/50 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-emerald-500/10 dark:from-amber-950/30 dark:via-stone-900/40 dark:to-emerald-950/30 p-3.5 sm:p-4 shadow-2xs transition-all ${className}`}
    >
      {/* Background Decorative Accents */}
      <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-gradient-to-br from-amber-400/10 to-transparent rounded-full blur-xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-3 w-32 h-16 bg-gradient-to-t from-emerald-400/5 to-transparent rounded-full blur-lg pointer-events-none" />

      {/* Header Row: Greeting with User Name, Label, Category, and Refresh Action */}
      <div className="relative flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60 dark:border-stone-800">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
          {/* Time of Day Greeting + User Name */}
          <div className="flex items-center space-x-1.5 mr-1">
            <span className="text-sm sm:text-base" role="img" aria-label="greeting icon">
              {timeGreeting.icon}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {timeGreeting.greeting}{resolvedName ? `, ${resolvedName}` : ''}!
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
              <Quote className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
              <span>Daily Quote</span>
            </span>
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/90 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50">
              {currentQuote.category}
            </span>
          </div>
        </div>

        {/* Refresh Icon Button */}
        <button
          type="button"
          id="refresh-quote-btn"
          aria-label="Refresh daily quote"
          onClick={handleRefresh}
          className="group inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-white/90 dark:bg-stone-800 hover:bg-white dark:hover:bg-stone-700 border border-amber-200/70 dark:border-stone-700 shadow-2xs transition-all active:scale-95 cursor-pointer self-start xs:self-auto shrink-0"
          title="Refresh to see another inspiring quote"
        >
          <RotateCw
            className={`w-3.5 h-3.5 text-amber-700 dark:text-amber-400 group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-transform ${
              isSpinning ? 'animate-spin' : 'group-hover:rotate-45'
            }`}
          />
          <span className="text-[11px] font-medium hidden sm:inline text-stone-600 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-white">
            New Quote
          </span>
        </button>
      </div>

      {/* Quote Body */}
      <div className="relative mt-2.5">
        <blockquote className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200 italic leading-relaxed">
          "{currentQuote.text}"
        </blockquote>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold text-stone-700 dark:text-stone-400 not-italic">
            — {currentQuote.author}
          </span>
          <span className="text-[10px] text-amber-800/60 dark:text-amber-400/60 font-mono font-medium">
            {currentIndex + 1} / {DAILY_QUOTES.length}
          </span>
        </div>
      </div>
    </div>
  );
};
