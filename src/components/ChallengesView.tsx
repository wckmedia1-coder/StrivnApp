import { useState, useEffect } from 'react';
import { Plus, Check, ChevronUp, X, Trophy, Flame, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { detectCategory, incrementTrait, getLevelFromXp } from '../lib/gameLogic';

type DailyChallenge = {
  id: string;
  user_id: string;
  title: string;
  goal_type: 'simple' | 'progress';
  target_value: number;
  unit: string;
  category: string;
  date: string;
  completed: boolean;
  progress_value: number;
  xp_earned: number;
  is_ai_generated?: boolean;
};

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "What you get by achieving your goals is not as important as what you become.", author: "Thoreau" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "You are never too old to set another goal or dream a new dream.", author: "C.S. Lewis" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { text: "Little things make big days.", author: "Unknown" },
  { text: "Your limitation — it's only your imagination.", author: "Unknown" },
  { text: "Sometimes later becomes never. Do it now.", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "The body achieves what the mind believes.", author: "Unknown" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "You don't find willpower, you create it.", author: "Unknown" },
  { text: "One step at a time is all it takes to get you there.", author: "Emily Dickinson" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Take care of your mind, your body will follow.", author: "Unknown" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
];

const CHALLENGE_POOL = [
  { title: "Walk for 10 minutes outside", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Read 10 pages of a book", category: "reading", goal_type: "progress" as const, target_value: 10, unit: "pages" },
  { title: "Drink 8 glasses of water", category: "nutrition", goal_type: "progress" as const, target_value: 8, unit: "glasses" },
  { title: "Meditate for 5 minutes", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 20 push-ups", category: "fitness", goal_type: "progress" as const, target_value: 20, unit: "reps" },
  { title: "Go to bed before 11pm", category: "sleep", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Eat a piece of fruit", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Stretch for 10 minutes", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Write 3 things you're grateful for", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Run or jog for 15 minutes", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Cook a healthy meal at home", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Draw or doodle for 10 minutes", category: "creativity", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Listen to a podcast episode", category: "reading", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 10 minutes of yoga", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Take a cold shower", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Walk 5,000 steps", category: "fitness", goal_type: "progress" as const, target_value: 5000, unit: "steps" },
  { title: "Spend 30 minutes screen-free", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Learn one new word or fact", category: "reading", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Write in your journal for 5 minutes", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 30 squats", category: "fitness", goal_type: "progress" as const, target_value: 30, unit: "reps" },
  { title: "Eat a vegetable with every meal", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Wake up without hitting snooze", category: "sleep", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Spend 15 minutes on a creative hobby", category: "creativity", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Take a 10-minute walk after dinner", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Read for 20 minutes before bed", category: "reading", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Drink a glass of water first thing in the morning", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 15 minutes of deep breathing", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Write down your top 3 goals for the day", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Cycle for 20 minutes", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Skip sugary drinks for the day", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do a 7-minute workout", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Tidy up one area of your home", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Send a kind message to someone", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Practice a musical instrument for 10 minutes", category: "creativity", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Sleep at least 7 hours tonight", category: "sleep", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 20 sit-ups", category: "fitness", goal_type: "progress" as const, target_value: 20, unit: "reps" },
  { title: "Eat breakfast today", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Watch an educational video", category: "reading", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Take 5 deep breaths when you feel stressed", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Write a short poem or story", category: "creativity", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Avoid social media for 2 hours", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Swim for 20 minutes", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Prep a healthy lunch the night before", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Read one chapter of a book", category: "reading", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do a plank for 30 seconds", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Spend time in nature for 15 minutes", category: "mindfulness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Sketch or paint something", category: "creativity", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Go to bed 30 minutes earlier than usual", category: "sleep", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Do 10 minutes of foam rolling", category: "fitness", goal_type: "simple" as const, target_value: 1, unit: "" },
  { title: "Try a new healthy recipe", category: "nutrition", goal_type: "simple" as const, target_value: 1, unit: "" },
];

function getDailyChallenges(dateStr: string) {
  const seed = dateStr.split('-').join('');
  const indices: number[] = [];
  let n = parseInt(seed);
  while (indices.length < 3) {
    n = (n * 1664525 + 1013904223) & 0xffffffff;
    const idx = Math.abs(n) % CHALLENGE_POOL.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map(i => CHALLENGE_POOL[i]);
}

function getDailyQuote(dateStr: string) {
  const seed = dateStr.split('-').join('');
  let n = parseInt(seed) * 31;
  n = (n * 1664525 + 1013904223) & 0xffffffff;
  return QUOTES[Math.abs(n) % QUOTES.length];
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ChallengesView() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<'simple' | 'progress'>('simple');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [incrementInputs, setIncrementInputs] = useState<Record<string, string>>({});
  const [showIncrementFor, setShowIncrementFor] = useState<string | null>(null);
  const [achievement, setAchievement] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const today = todayStr();
  const dailyChallenges = getDailyChallenges(today);
  const dailyQuote = getDailyQuote(today);

  const completedCount = challenges.filter(c => c.completed).length;
  const allComplete = challenges.length === 5 && completedCount === 5;
  const hasBonus = challenges.length === 6;
  const canAdd = challenges.length < 5 || (allComplete && !hasBonus);
  const isBonus = challenges.length === 5 && allComplete;

  const totalXp = (profile as any)?.total_xp ?? 0;
  const { level, xpInLevel, xpNeeded } = getLevelFromXp(totalXp);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('user_id', user!.id)
      .eq('date', today)
      .order('created_at', { ascending: true });
    setChallenges((data ?? []) as DailyChallenge[]);
    setLoading(false);
  };

  const addSuggestedChallenge = async (suggestion: typeof CHALLENGE_POOL[0]) => {
    if (!user) return;
    if (challenges.length >= 5 && !isBonus) return;
    if (challenges.some(c => c.title === suggestion.title)) return;

    setAddingId(suggestion.title);
    try {
      const { data, error } = await supabase.from('daily_challenges').insert({
        user_id: user.id,
        title: suggestion.title,
        goal_type: suggestion.goal_type,
        target_value: suggestion.target_value,
        unit: suggestion.unit,
        category: suggestion.category,
        date: today,
        completed: false,
        progress_value: 0,
        xp_earned: 0,
        is_ai_generated: false,
      }).select().single();

      if (error) {
        console.error('Error adding challenge:', error);
      } else if (data) {
        setChallenges(prev => [...prev, data as DailyChallenge]);
      }
    } finally {
      setAddingId(null);
    }
  };

  const addChallenge = async () => {
    if (!title.trim() || !user) return;
    if (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0)) return;
    const category = detectCategory(title.trim());
    const { data, error } = await supabase.from('daily_challenges').insert({
      user_id: user.id,
      title: title.trim(),
      goal_type: goalType,
      target_value: goalType === 'progress' ? parseFloat(targetValue) : 1,
      unit: goalType === 'progress' ? unit.trim() : '',
      category,
      date: today,
      completed: false,
      progress_value: 0,
      xp_earned: 0,
      is_ai_generated: false,
    }).select().single();
    if (error) {
      console.error('Error adding challenge:', error);
    } else if (data) {
      setChallenges(prev => [...prev, data as DailyChallenge]);
      setTitle(''); setTargetValue(''); setUnit('');
      setGoalType('simple'); setShowAdd(false);
    }
  };

  const awardXp = async () => {
    const oldXp = (profile as any)?.total_xp ?? 0;
    const newXp = oldXp + 1;
    const oldLevel = getLevelFromXp(oldXp).level;
    const newLevel = getLevelFromXp(newXp).level;
    await supabase.from('profiles').update({ total_xp: newXp }).eq('id', user!.id);
    if (newLevel > oldLevel) setLevelUp(newLevel);
    await refreshProfile();
  };

  const completeSimple = async (c: DailyChallenge) => {
    if (c.completed || !profile) return;
    await supabase.from('daily_challenges').update({
      completed: true,
      completed_at: new Date().toISOString(),
      xp_earned: 1,
    }).eq('id', c.id);
    await incrementTrait(user!.id, c.category as any);
    await awardXp();
    await load();
    showAchievementIfAllDone();
  };

  const addProgress = async (c: DailyChallenge) => {
    if (c.completed || !profile) return;
    const inc = parseFloat(incrementInputs[c.id] || '1');
    if (isNaN(inc) || inc <= 0) return;
    const newProg = Math.min((c.progress_value ?? 0) + inc, c.target_value);
    const done = newProg >= c.target_value;
    await supabase.from('daily_challenges').update({
      progress_value: newProg,
      completed: done,
      completed_at: done ? new Date().toISOString() : null,
      xp_earned: done ? 1 : 0,
    }).eq('id', c.id);
    if (done) {
      await incrementTrait(user!.id, c.category as any);
      await awardXp();
      showAchievementIfAllDone();
    }
    setIncrementInputs(p => ({ ...p, [c.id]: '' }));
    setShowIncrementFor(null);
    await load();
  };

  const deleteChallenge = async (id: string) => {
    const c = challenges.find(ch => ch.id === id);
    if (c?.completed) return;
    await supabase.from('daily_challenges').delete().eq('id', id);
    setChallenges(prev => prev.filter(ch => ch.id !== id));
  };

  const showAchievementIfAllDone = () => {
    const updated = challenges.filter(c => c.completed).length + 1;
    if (updated === 5) {
      setAchievement('🌿 All 5 done! Bonus challenge unlocked!');
      setTimeout(() => setAchievement(null), 4000);
    }
  };

  const categoryEmoji: Record<string, string> = {
    fitness: '💪', reading: '📚', mindfulness: '🧘',
    creativity: '🎨', sleep: '😴', nutrition: '🥗', other: '✨'
  };

  const accentSoft = dark ? 'bg-indigo-500/10' : 'bg-indigo-50';
  const card = `rounded-2xl border transition-all ${dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200/80 shadow-sm'}`;
  const text = dark ? 'text-white' : 'text-slate-800';
  const subtext = dark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`;

  if (loading) return <div className={`text-center py-8 ${subtext}`}>Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {achievement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold px-6 py-3 rounded-full shadow-xl animate-bounce">
          {achievement}
        </div>
      )}
      {levelUp && (
        <div onClick={() => setLevelUp(null)}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold px-6 py-3 rounded-full shadow-xl animate-bounce cursor-pointer">
          ✨ Level Up! You're now Level {levelUp}
        </div>
      )}

      {/* Daily Quote */}
      <div className={`${card} p-5 relative overflow-hidden`}>
        <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-gradient-to-b from-indigo-500 to-violet-400" />
        <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ml-3 ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>
          ✨ Quote of the Day
        </p>
        <p className={`text-base font-medium leading-relaxed ml-3 mb-2 ${text}`}>
          "{dailyQuote.text}"
        </p>
        <p className={`text-sm ml-3 ${subtext}`}>— {dailyQuote.author}</p>
      </div>

      {/* Header: XP & Progress */}
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className={`text-lg font-bold ${text}`}>Daily Challenges</h2>
              <p className={`text-xs ${subtext}`}>{completedCount}/{challenges.length} completed today</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-orange-400 text-sm font-semibold">
              <Flame className="w-4 h-4" />
              <span>{profile?.streak_count ?? 0}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${dark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
              <span>Lv {level}</span>
              <span className="opacity-50">·</span>
              <span>{xpInLevel}/{xpNeeded} XP</span>
            </div>
          </div>
        </div>

        <div className={`rounded-full h-2 overflow-hidden mb-1 ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
          <div className="h-2 rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-500 to-violet-400"
            style={{ width: `${challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0}%` }} />
        </div>
        <div className={`rounded-full h-1 overflow-hidden mt-2 ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
          <div className="h-1 rounded-full transition-all duration-700 bg-gradient-to-r from-amber-400 to-orange-300"
            style={{ width: `${(xpInLevel / xpNeeded) * 100}%` }} />
        </div>
        <p className={`text-[10px] mt-1 ${subtext}`}>{xpInLevel}/{xpNeeded} XP to Level {level + 1} · Each challenge earns 1 XP</p>

        {allComplete && (
          <p className="text-sm text-indigo-400 font-semibold mt-3 text-center">
            🌿 All done! {hasBonus ? 'Bonus challenge added.' : 'Bonus challenge unlocked!'}
          </p>
        )}
      </div>

      {/* Daily Suggested Challenges */}
      <div className={`${card} overflow-hidden`}>
        <div className={`px-5 py-4 ${accentSoft}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className={`font-semibold text-sm ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              Today's Suggested Challenges
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
              Refreshes daily
            </span>
          </div>
          <p className={`text-xs mt-1 ${subtext}`}>3 new challenges every day — tap to add them</p>
        </div>

        <div className="p-4 space-y-2">
          {dailyChallenges.map((s, i) => {
            const alreadyAdded = challenges.some(c => c.title === s.title);
            const isAdding = addingId === s.title;
            const isDisabled = (challenges.length >= 5 && !isBonus) || alreadyAdded || isAdding;
            return (
              <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${dark ? 'bg-[#13132a] border-[#2a2a4a]' : 'bg-indigo-50/60 border-indigo-100'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base flex-shrink-0">{categoryEmoji[s.category] ?? '✨'}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${text}`}>{s.title}</p>
                    {s.goal_type === 'progress' && (
                      <p className={`text-xs ${subtext}`}>Target: {s.target_value} {s.unit}</p>
                    )}
                  </div>
                </div>
                {alreadyAdded ? (
                  <span className={`flex-shrink-0 ml-3 text-xs font-semibold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>✓ Added</span>
                ) : (
                  <button
                    onClick={() => addSuggestedChallenge(s)}
                    disabled={isDisabled}
                    className={`flex-shrink-0 ml-3 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isDisabled
                        ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                        : dark ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}>
                    <Plus className="w-3 h-3" /> {isAdding ? '...' : 'Add'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* My Challenges */}
      {challenges.length > 0 && (
        <div className="space-y-2">
          <h3 className={`text-sm font-semibold px-1 ${subtext}`}>My Challenges</h3>
          {challenges.map((c, idx) => {
            const isBonusChallenge = idx === 5;
            const pct = c.goal_type === 'progress' ? Math.min((c.progress_value / c.target_value) * 100, 100) : 0;
            const showingInc = showIncrementFor === c.id;

            return (
              <div key={c.id} className={`rounded-2xl border-2 p-4 transition-all ${
                c.completed
                  ? dark ? 'border-indigo-500/30 bg-indigo-900/10' : 'border-indigo-200 bg-indigo-50/60'
                  : isBonusChallenge
                    ? dark ? 'border-amber-500/30 bg-amber-900/10' : 'border-amber-300/60 bg-amber-50'
                    : dark ? 'border-[#2a2a4a] bg-[#1a1a2e]' : 'border-slate-200 bg-white shadow-sm'
              }`}>
                {isBonusChallenge && <div className="text-xs font-bold text-amber-500 mb-2">⭐ Bonus Challenge</div>}

                <div className="flex items-center gap-3">
                  {c.goal_type === 'simple' ? (
                    <button onClick={() => completeSimple(c)} disabled={c.completed}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        c.completed
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-400 border-transparent'
                          : dark ? 'border-[#3a3a5c] hover:border-indigo-400' : 'border-slate-300 hover:border-indigo-400'
                      }`}>
                      {c.completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ) : (
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      c.completed ? 'bg-gradient-to-br from-indigo-500 to-violet-400 border-transparent' : dark ? 'border-[#3a3a5c]' : 'border-slate-300'
                    }`}>
                      {c.completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`font-medium text-sm truncate ${c.completed ? (dark ? 'text-slate-500 line-through' : 'text-slate-400 line-through') : text}`}>
                        {c.title}
                      </p>
                      {c.category && <span className="text-sm flex-shrink-0">{categoryEmoji[c.category] ?? '✨'}</span>}
                    </div>
                    {c.goal_type === 'progress' && (
                      <p className={`text-xs mt-0.5 ${subtext}`}>
                        {c.progress_value}{c.unit ? ` ${c.unit}` : ''} / {c.target_value}{c.unit ? ` ${c.unit}` : ''}
                      </p>
                    )}
                  </div>

                  {c.completed && (
                    <span className={`text-xs font-bold flex-shrink-0 ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>+1 XP</span>
                  )}

                  {c.goal_type === 'progress' && !c.completed && (
                    <button onClick={() => setShowIncrementFor(showingInc ? null : c.id)}
                      className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-400 text-white flex items-center justify-center">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!c.completed && (
                    <button onClick={() => deleteChallenge(c.id)}
                      className={`flex-shrink-0 transition-colors ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {c.goal_type === 'progress' && (
                  <div className={`mt-3 rounded-full h-1.5 overflow-hidden ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {showingInc && !c.completed && (
                  <div className="mt-3 flex gap-2 items-center">
                    <input type="number" value={incrementInputs[c.id] || ''} min="0.01" step="0.01"
                      onChange={e => setIncrementInputs(p => ({ ...p, [c.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addProgress(c)}
                      placeholder={`Add ${c.unit || 'amount'}…`}
                      className={inputCls} autoFocus />
                    <button onClick={() => addProgress(c)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-400 text-white text-sm font-medium">
                      Add
                    </button>
                    <button onClick={() => setShowIncrementFor(null)} className={subtext}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add your own */}
      {canAdd && !showAdd && (
        <button onClick={() => setShowAdd(true)}
          className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all ${
            isBonus
              ? 'border-amber-400 text-amber-500 hover:bg-amber-50'
              : dark ? 'border-[#2a2a4a] text-slate-400 hover:border-indigo-400 hover:text-indigo-400' : 'border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
          }`}>
          <Plus className="w-4 h-4" />
          {isBonus ? '⭐ Add Bonus Challenge' : `Add Your Own (${challenges.length}/5)`}
        </button>
      )}

      {!canAdd && challenges.length >= 5 && !allComplete && (
        <div className={`text-center text-sm py-3 rounded-2xl ${dark ? 'bg-[#1a1a2e] text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
          🔒 Complete all 5 to unlock a bonus challenge
        </div>
      )}

      {showAdd && (
        <div className={`rounded-2xl border-2 p-5 space-y-3 ${dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`font-semibold text-sm ${text}`}>{isBonus ? '⭐ Bonus Challenge' : 'New Challenge'}</h3>
          <input value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goalType === 'simple' && addChallenge()}
            placeholder="e.g. Drink 8 cups of water" maxLength={100} autoFocus
            className={inputCls} />
          <div className="flex gap-2">
            {(['simple', 'progress'] as const).map(t => (
              <button key={t} onClick={() => setGoalType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  goalType === t ? 'bg-gradient-to-r from-indigo-500 to-violet-400 text-white' : dark ? 'bg-[#0d0d1a] text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}>
                {t === 'simple' ? 'Simple' : 'Progress'}
              </button>
            ))}
          </div>
          {goalType === 'progress' && (
            <div className="flex gap-2">
              <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                placeholder="Target (e.g. 8)" min="0.01" step="0.01" className={inputCls} />
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                placeholder="Unit (e.g. cups)" maxLength={10} className={inputCls} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addChallenge}
              disabled={!title.trim() || (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0))}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-400 text-white font-semibold text-sm disabled:opacity-50">
              Add
            </button>
            <button onClick={() => { setShowAdd(false); setTitle(''); setTargetValue(''); setUnit(''); setGoalType('simple'); }}
              className={`px-4 py-2 text-sm ${subtext}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className={`rounded-2xl p-5 text-sm space-y-1 ${dark ? 'bg-[#1a1a2e] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <p className={`font-semibold mb-2 ${text}`}>How it works</p>
        <p>• 3 new suggested challenges appear every day</p>
        <p>• Add up to 5 challenges total — mix suggestions with your own</p>
        <p>• Each completed challenge earns <strong>1 XP</strong></p>
        <p>• Complete all 5 to unlock a bonus 6th challenge</p>
        <p>• A new quote arrives every day to keep you motivated</p>
      </div>
    </div>
  );
}
