import { useState, useEffect } from 'react';
import { Plus, Check, ChevronUp, X, Trophy, Flame, Trash2 } from 'lucide-react';
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
  gems_earned: number;
};

const today = () => {
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

  const todayStr = today();
  const completedCount = challenges.filter(c => c.completed).length;
  const allComplete = challenges.length === 5 && completedCount === 5;
  const hasBonus = challenges.length === 6;
  const canAdd = challenges.length < 5 || (allComplete && !hasBonus);
  const isBonus = challenges.length === 5 && allComplete;

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('user_id', user!.id)
      .eq('date', todayStr)
      .order('created_at', { ascending: true });
    setChallenges((data ?? []) as DailyChallenge[]);
    setLoading(false);
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
      date: todayStr,
      completed: false,
      progress_value: 0,
      gems_earned: 0,
    }).select().single();

    if (data && !error) {
      setChallenges(prev => [...prev, data as DailyChallenge]);
      setTitle(''); setTargetValue(''); setUnit('');
      setGoalType('simple'); setShowAdd(false);
    }
  };

  const completeSimple = async (c: DailyChallenge) => {
    if (c.completed || !profile) return;
    const gems = profile.streak_count >= 5 ? 3 : 2;
    await supabase.from('daily_challenges').update({
      completed: true, completed_at: new Date().toISOString(), gems_earned: gems,
    }).eq('id', c.id);
    await supabase.from('profiles').update({
      gem_balance: profile.gem_balance + gems,
      total_gems_earned: profile.total_gems_earned + gems,
    }).eq('id', user!.id);
    await incrementTrait(user!.id, c.category as any);
    await refreshProfile();
    await load();
    showAchievementIfAllDone();
  };

  const addProgress = async (c: DailyChallenge) => {
    if (c.completed || !profile) return;
    const inc = parseFloat(incrementInputs[c.id] || '1');
    if (isNaN(inc) || inc <= 0) return;
    const newProg = Math.min((c.progress_value ?? 0) + inc, c.target_value);
    const done = newProg >= c.target_value;
    const gems = profile.streak_count >= 5 ? 3 : 2;
    await supabase.from('daily_challenges').update({
      progress_value: newProg,
      completed: done,
      completed_at: done ? new Date().toISOString() : null,
      gems_earned: done ? gems : 0,
    }).eq('id', c.id);
    if (done) {
      await supabase.from('profiles').update({
        gem_balance: profile.gem_balance + gems,
        total_gems_earned: profile.total_gems_earned + gems,
      }).eq('id', user!.id);
      await incrementTrait(user!.id, c.category as any);
      await refreshProfile();
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
      setAchievement('🎉 All 5 challenges done! Bonus challenge unlocked!');
      setTimeout(() => setAchievement(null), 4000);
    }
  };

  const card = `rounded-xl border-2 p-4 transition-all ${
    dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200'
  }`;
  const text = dark ? 'text-white' : 'text-slate-900';
  const subtext = dark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#a855f7] ${
    dark ? 'bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'
  }`;

  if (loading) return <div className={`text-center py-8 ${subtext}`}>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {achievement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white font-semibold px-6 py-3 rounded-full shadow-lg animate-bounce">
          {achievement}
        </div>
      )}

      {/* Header card */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-[#a855f7]" />
            <div>
              <h2 className={`text-xl font-bold ${text}`}>Daily Challenges</h2>
              <p className={`text-sm ${subtext}`}>{completedCount}/{challenges.length} completed today</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-orange-400 text-sm font-semibold">
            <Flame className="w-4 h-4" />
            <span>{profile?.streak_count ?? 0}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`rounded-full h-2.5 overflow-hidden ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
          <div
            className="h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r from-[#a855f7] to-[#ec4899]"
            style={{ width: `${challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0}%` }}
          />
        </div>

        {allComplete && (
          <p className="text-sm text-[#a855f7] font-semibold mt-2 text-center">
            🔥 All done! {hasBonus ? 'Bonus challenge added below.' : 'Bonus challenge slot unlocked!'}
          </p>
        )}
      </div>

      {/* Challenge list */}
      {challenges.length === 0 && (
        <div className={`text-center py-12 ${subtext}`}>
          <p className="text-3xl mb-2">🎯</p>
          <p>No challenges yet. Add your first one below!</p>
        </div>
      )}

      {challenges.map((c, idx) => {
        const isBonus = idx === 5;
        const pct = c.goal_type === 'progress' ? Math.min((c.progress_value / c.target_value) * 100, 100) : 0;
        const showingInc = showIncrementFor === c.id;

        return (
          <div key={c.id} className={`rounded-xl border-2 p-4 transition-all ${
            c.completed
              ? dark ? 'border-[#a855f7]/40 bg-[#1a1a2e]' : 'border-[#ec4899]/30 bg-pink-50'
              : isBonus
                ? dark ? 'border-yellow-500/40 bg-[#1a1a2e]' : 'border-yellow-400/50 bg-yellow-50'
                : dark ? 'border-[#2a2a4a] bg-[#1a1a2e]' : 'border-slate-200 bg-white'
          }`}>
            {isBonus && (
              <div className="text-xs font-bold text-yellow-500 mb-2 flex items-center gap-1">
                ⭐ Bonus Challenge
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Complete button */}
              {c.goal_type === 'simple' ? (
                <button onClick={() => completeSimple(c)} disabled={c.completed}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    c.completed
                      ? 'bg-gradient-to-br from-[#a855f7] to-[#ec4899] border-transparent'
                      : dark ? 'border-[#3a3a5c] hover:border-[#a855f7]' : 'border-slate-300 hover:border-[#a855f7]'
                  }`}>
                  {c.completed && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ) : (
                <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  c.completed ? 'bg-gradient-to-br from-[#a855f7] to-[#ec4899] border-transparent' : dark ? 'border-[#3a3a5c]' : 'border-slate-300'
                }`}>
                  {c.completed && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              )}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`font-medium truncate ${c.completed ? (dark ? 'text-slate-500 line-through' : 'text-slate-400 line-through') : text}`}>
                    {c.title}
                  </p>
                  {c.category && c.category !== 'general' && (
                    <span className="text-sm flex-shrink-0">
                      {({ fitness:'💪', reading:'📚', mindfulness:'🧘', creativity:'🎨', sleep:'😴', nutrition:'🥗' } as any)[c.category]}
                    </span>
                  )}
                </div>
                {c.goal_type === 'progress' && (
                  <p className={`text-xs mt-0.5 ${subtext}`}>
                    {c.progress_value}{c.unit ? ` ${c.unit}` : ''} / {c.target_value}{c.unit ? ` ${c.unit}` : ''}
                  </p>
                )}
              </div>

              {/* Gems */}
              {c.completed && (
                <span className="text-xs font-bold text-[#a855f7] flex-shrink-0">+{c.gems_earned}💎</span>
              )}

              {/* Progress + button */}
              {c.goal_type === 'progress' && !c.completed && (
                <button onClick={() => setShowIncrementFor(showingInc ? null : c.id)}
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#a855f7] to-[#ec4899] text-white flex items-center justify-center">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Delete */}
              {!c.completed && (
                <button onClick={() => deleteChallenge(c.id)} className={`flex-shrink-0 ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'} transition-colors`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {c.goal_type === 'progress' && (
              <div className={`mt-3 rounded-full h-1.5 overflow-hidden ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
                <div className="h-1.5 rounded-full bg-gradient-to-r from-[#a855f7] to-[#ec4899] transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}

            {/* Increment input */}
            {showingInc && !c.completed && (
              <div className="mt-3 flex gap-2 items-center">
                <input type="number" value={incrementInputs[c.id] || ''} min="0.01" step="0.01"
                  onChange={e => setIncrementInputs(p => ({ ...p, [c.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addProgress(c)}
                  placeholder={`Add ${c.unit || 'amount'}...`}
                  className={inputCls} autoFocus />
                <button onClick={() => addProgress(c)}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white text-sm font-medium">
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

      {/* Add challenge */}
      {canAdd && !showAdd && (
        <button onClick={() => setShowAdd(true)}
          className={`w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all ${
            isBonus
              ? 'border-yellow-400 text-yellow-500 hover:bg-yellow-50'
              : dark ? 'border-[#2a2a4a] text-slate-400 hover:border-[#a855f7] hover:text-[#a855f7]' : 'border-slate-200 text-slate-400 hover:border-[#a855f7] hover:text-[#a855f7]'
          }`}>
          <Plus className="w-4 h-4" />
          {isBonus ? '⭐ Add Bonus Challenge' : `Add Challenge (${challenges.length}/5)`}
        </button>
      )}

      {!canAdd && challenges.length >= 5 && !allComplete && (
        <div className={`text-center text-sm py-3 rounded-xl ${dark ? 'bg-[#1a1a2e] text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
          🔒 Complete all 5 to unlock a bonus challenge
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className={`rounded-xl border-2 p-4 space-y-3 ${
          dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200'
        }`}>
          <h3 className={`font-semibold text-sm ${text}`}>
            {isBonus ? '⭐ Add Bonus Challenge' : 'New Challenge'}
          </h3>

          <input value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goalType === 'simple' && addChallenge()}
            placeholder="e.g. Drink 8 cups of water" maxLength={100} autoFocus
            className={inputCls} />

          {/* Live category preview */}
          {title.trim() && (
            <p className={`text-xs ${subtext}`}>
              Category:{' '}
              <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>
                {({ fitness:'💪 Fitness', reading:'📚 Reading', mindfulness:'🧘 Mindfulness', creativity:'🎨 Creativity', sleep:'😴 Sleep', nutrition:'🥗 Nutrition', general:'⚪ General' } as any)[detectCategory(title)] ?? 'General'}
              </span>
            </p>
          )}

          {/* Type toggle */}
          <div className="flex gap-2">
            <button onClick={() => setGoalType('simple')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                goalType === 'simple'
                  ? 'bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white'
                  : dark ? 'bg-[#0d0d1a] text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
              ✅ Simple
            </button>
            <button onClick={() => setGoalType('progress')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                goalType === 'progress'
                  ? 'bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white'
                  : dark ? 'bg-[#0d0d1a] text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
              📊 Progress
            </button>
          </div>

          {goalType === 'progress' && (
            <div className="flex gap-2">
              <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                placeholder="Target (e.g. 8)" min="0.01" step="0.01"
                className={inputCls} />
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                placeholder="Unit (e.g. cups, km)" maxLength={10}
                className={inputCls} />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={addChallenge}
              disabled={!title.trim() || (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0))}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white font-semibold text-sm disabled:opacity-50">
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
      <div className={`rounded-xl p-5 text-sm space-y-1 ${dark ? 'bg-[#1a1a2e] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <p className={`font-semibold mb-2 ${text}`}>How challenges work</p>
        <p>• Add up to 5 custom challenges per day</p>
        <p>• Use <strong>Progress</strong> mode to track units (cups, km, pages...)</p>
        <p>• Each completed challenge = {profile?.streak_count && profile.streak_count >= 5 ? '3 gems (hot streak! 🔥)' : '2 gems'}</p>
        <p>• Complete all 5 to unlock a bonus 6th challenge</p>
        <p>• Challenges reset daily at midnight</p>
      </div>
    </div>
  );
}
