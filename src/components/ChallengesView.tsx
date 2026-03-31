import { useState, useEffect } from 'react';
import { Plus, Check, ChevronUp, X, Trophy, Flame, Trash2, Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { detectCategory, incrementTrait } from '../lib/gameLogic';

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

export function xpToNextLevel(level: number): number {
  return Math.round(3 * Math.pow(1.5, level - 1));
}

export function getLevelFromXp(totalXp: number): { level: number; xpInLevel: number; xpNeeded: number } {
  let level = 1;
  let remaining = totalXp;
  while (true) {
    const needed = xpToNextLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpNeeded: needed };
    remaining -= needed;
    level++;
  }
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';

const CALM_SYSTEM_PROMPT = `You are a calm, supportive wellness coach for the app Strivn.
Generate short, gentle daily challenge suggestions personalised to the user's recent activity.
Each challenge should feel achievable, calming, and growth-oriented.
Respond ONLY with a valid JSON array of 3 objects, no markdown, no extra text.
Each object: { "title": string, "category": "fitness"|"sleep"|"nutrition"|"mindfulness"|"reading"|"creativity"|"other", "goal_type": "simple"|"progress", "target_value": number, "unit": string }
For simple goals, target_value=1, unit="".
Keep titles under 60 chars. Tone: warm, encouraging, calm.`;

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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestFull, setAiSuggestFull] = useState<any[]>([]);
  const [showAiSection, setShowAiSection] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  const today = todayStr();
  const completedCount = challenges.filter(c => c.completed).length;
  const allComplete = challenges.length === 5 && completedCount === 5;
  const hasBonus = challenges.length === 6;
  const canAdd = challenges.length < 5 || (allComplete && !hasBonus);
  const isBonus = challenges.length === 5 && allComplete;

  const totalXp = (profile as any)?.total_xp ?? 0;
  const { level, xpInLevel, xpNeeded } = getLevelFromXp(totalXp);

  useEffect(() => {
    if (user) { load(); loadAiSuggestions(); }
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

  const buildUserContext = () => {
    const names = challenges.map(c => c.title).join(', ');
    const cats = [...new Set(challenges.map(c => c.category))].join(', ');
    if (!names) return 'This user is just getting started. Suggest beginner-friendly wellness challenges.';
    return `The user's recent challenges include: ${names}. Categories they focus on: ${cats || 'general'}. Suggest 3 new complementary challenges they haven't tried yet today.`;
  };

  const loadAiSuggestions = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      if (!GROQ_API_KEY) throw new Error('No API key configured');
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1000,
          messages: [
            { role: 'system', content: CALM_SYSTEM_PROMPT },
            { role: 'user', content: buildUserContext() },
          ],
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? '[]';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setAiSuggestFull(parsed);
    } catch {
      setAiError("Couldn't load suggestions right now. Try refreshing.");
      setAiSuggestFull([]);
    }
    setAiLoading(false);
  };

  const addAiChallenge = async (suggestion: any) => {
    if (challenges.length >= 5 && !isBonus) return;
    const category = suggestion.category ?? detectCategory(suggestion.title);
    const { data, error } = await supabase.from('daily_challenges').insert({
      user_id: user!.id,
      title: suggestion.title,
      goal_type: suggestion.goal_type ?? 'simple',
      target_value: suggestion.target_value ?? 1,
      unit: suggestion.unit ?? '',
      category,
      date: today,
      completed: false,
      progress_value: 0,
      xp_earned: 0,
      is_ai_generated: true,
    }).select().single();
    if (data && !error) {
      setChallenges(prev => [...prev, data as DailyChallenge]);
      setAiSuggestFull(prev => prev.filter(s => s.title !== suggestion.title));
    }
  };

  const addChallenge = async () => {
    if (!title.trim()) return;
    if (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0)) return;
    const category = detectCategory(title.trim());
    const { data, error } = await supabase.from('daily_challenges').insert({
      user_id: user!.id,
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
    if (data && !error) {
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

  const accent = '#6366f1';
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

      {/* Header */}
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

      {/* AI Suggestions */}
      <div className={`${card} overflow-hidden`}>
        <button onClick={() => setShowAiSection(v => !v)}
          className={`w-full flex items-center justify-between px-5 py-4 ${accentSoft} transition-colors`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className={`font-semibold text-sm ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}>AI Suggested for You</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>Personalised</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); loadAiSuggestions(); }}
              className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-300' : 'hover:bg-indigo-100 text-slate-400 hover:text-indigo-600'}`}
              title="Refresh suggestions">
              <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            </button>
            <ChevronDown className={`w-4 h-4 ${subtext} transition-transform ${showAiSection ? '' : '-rotate-90'}`} />
          </div>
        </button>

        {showAiSection && (
          <div className="p-4 space-y-2">
            {aiLoading && (
              <div className={`text-center py-4 text-sm ${subtext}`}>
                <div className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2" />
                Thinking of something just for you…
              </div>
            )}
            {!aiLoading && aiError && (
              <p className={`text-sm text-center py-3 text-red-400`}>{aiError}</p>
            )}
            {!aiLoading && !aiError && aiSuggestFull.length === 0 && (
              <p className={`text-sm text-center py-3 ${subtext}`}>No suggestions right now — try refreshing.</p>
            )}
            {!aiLoading && aiSuggestFull.map((s, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${dark ? 'bg-[#13132a] border-[#2a2a4a]' : 'bg-indigo-50/60 border-indigo-100'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base flex-shrink-0">
                    {({ fitness:'💪', sleep:'😴', nutrition:'🥗', mindfulness:'🧘', reading:'📚', creativity:'🎨', other:'✨' } as any)[s.category] ?? '✨'}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${text}`}>{s.title}</p>
                    {s.goal_type === 'progress' && (
                      <p className={`text-xs ${subtext}`}>{s.target_value} {s.unit}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => addAiChallenge(s)}
                  disabled={challenges.length >= 5 && !isBonus}
                  className={`flex-shrink-0 ml-3 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    challenges.length >= 5 && !isBonus
                      ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                      : dark ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            ))}
            <p className={`text-[10px] text-center pt-1 ${subtext}`}>Suggestions personalise based on your activity over time</p>
          </div>
        )}
      </div>

      {/* My Challenges */}
      <div className="space-y-2">
        <h3 className={`text-sm font-semibold px-1 ${subtext}`}>My Challenges</h3>

        {challenges.length === 0 && (
          <div className={`text-center py-10 ${subtext}`}>
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm">Add a challenge or pick one from AI suggestions above</p>
          </div>
        )}

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
              {c.is_ai_generated && !isBonusChallenge && (
                <div className={`text-[10px] font-medium mb-1.5 flex items-center gap-1 ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>
                  <Sparkles className="w-2.5 h-2.5" /> AI suggested
                </div>
              )}

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
                    {c.category && c.category !== 'general' && (
                      <span className="text-sm flex-shrink-0">
                        {({ fitness:'💪', reading:'📚', mindfulness:'🧘', creativity:'🎨', sleep:'😴', nutrition:'🥗', other:'✨' } as any)[c.category]}
                      </span>
                    )}
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

      {/* Add challenge */}
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
          {title.trim() && (
            <p className={`text-xs ${subtext}`}>
              Category:{' '}
              <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>
                {({ fitness:'💪 Fitness', reading:'📚 Reading', mindfulness:'🧘 Mindfulness', creativity:'🎨 Creativity', sleep:'😴 Sleep', nutrition:'🥗 Nutrition', other:'✨ Other', general:'⚪ General' } as any)[detectCategory(title)] ?? '✨ Other'}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            {(['simple', 'progress'] as const).map(t => (
              <button key={t} onClick={() => setGoalType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  goalType === t ? 'bg-gradient-to-r from-indigo-500 to-violet-400 text-white' : dark ? 'bg-[#0d0d1a] text-slate-400' : 'bg-slate-100 text-slate-600'
                }`}>
                {t === 'simple' ? '✅ Simple' : '📊 Progress'}
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
        <p>• Add up to 5 daily challenges — pick from AI suggestions or write your own</p>
        <p>• Each completed challenge earns <strong>1 XP</strong> — levels get harder as you grow</p>
        <p>• XP required per level increases: 3 → 5 → 8 → 11 → 17…</p>
        <p>• Complete all 5 to unlock a bonus 6th challenge</p>
        <p>• AI suggestions personalise over time as it learns your habits</p>
      </div>
    </div>
  );
}
