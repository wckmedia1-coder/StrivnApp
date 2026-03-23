import { useState, useEffect } from 'react';
import { Plus, Check, Flame, X, Pencil, Save, ChevronUp } from 'lucide-react';
import { supabase, Goal, DailyGoalInstance } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkAndAwardAchievements } from '../lib/achievements';
import { detectCategory, incrementTrait } from '../lib/gameLogic';

type GoalWithProgress = Goal & {
  goal_type?: string;
  target_value?: number;
  unit?: string;
  category?: string;
};

type InstanceWithProgress = DailyGoalInstance & {
  progress_value?: number;
};

export function GoalsView() {
  const { user, profile, refreshProfile } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [todayInstances, setTodayInstances] = useState<InstanceWithProgress[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [goalType, setGoalType] = useState<'simple' | 'progress'>('simple');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [incrementInputs, setIncrementInputs] = useState<Record<string, string>>({});
  const [showIncrementFor, setShowIncrementFor] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const totalGoalsToday = todayInstances.length;
  const canAddMore = goals.filter(g => g.is_active).length < 5;

  useEffect(() => {
    if (user) {
      loadGoals();
      loadTodayInstances();
    }
  }, [user]);

  const loadGoals = async () => {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (data) setGoals(data);
    setLoading(false);
  };

  const loadTodayInstances = async () => {
    const { data } = await supabase
      .from('daily_goal_instances')
      .select('*')
      .eq('user_id', user?.id)
      .eq('date', today);
    if (data) setTodayInstances(data);
  };

  const createGoal = async () => {
    if (!newGoalTitle.trim() || !canAddMore) return;
    if (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0)) return;

    // Auto-detect category from title
    const category = detectCategory(newGoalTitle.trim());

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user?.id,
        title: newGoalTitle.trim(),
        is_recurring: isRecurring,
        goal_type: goalType,
        target_value: goalType === 'progress' ? parseFloat(targetValue) : 1,
        unit: goalType === 'progress' ? unit.trim() : '',
        category,
      })
      .select()
      .single();

    if (data && !error) {
      setGoals([...goals, data]);
      setNewGoalTitle('');
      setTargetValue('');
      setUnit('');
      setGoalType('simple');
      setShowAddGoal(false);

      await supabase.from('daily_goal_instances').insert({
        goal_id: data.id,
        user_id: user?.id,
        date: today,
        completed: false,
        gems_earned: 0,
        progress_value: 0,
      });

      await loadTodayInstances();
    }
  };

  const deleteGoal = async (goalId: string) => {
    const instance = todayInstances.find(i => i.goal_id === goalId);
    if (instance?.completed) return;
    await supabase.from('goals').update({ is_active: false }).eq('id', goalId);
    setGoals(goals.filter(g => g.id !== goalId));
    setTodayInstances(todayInstances.filter(i => i.goal_id !== goalId));
  };

  const startEditing = (goal: GoalWithProgress) => {
    const instance = todayInstances.find(i => i.goal_id === goal.id);
    if (instance?.completed) return;
    setEditingGoalId(goal.id);
    setEditingTitle(goal.title);
  };

  const saveEdit = async (goalId: string) => {
    if (!editingTitle.trim()) return;
    await supabase
      .from('goals')
      .update({ title: editingTitle.trim() })
      .eq('id', goalId);
    setGoals(goals.map(g => g.id === goalId ? { ...g, title: editingTitle.trim() } : g));
    setEditingGoalId(null);
    setEditingTitle('');
  };

  // Helper: fire trait increment after a goal completes
  const handleTraitIncrement = async (goalId: string) => {
    if (!user) return;
    const goal = goals.find(g => g.id === goalId);
    const category = goal?.category ?? detectCategory(goal?.title ?? '');
    await incrementTrait(user.id, category as any);
  };

  // Simple goal — just tick it
  const completeSimpleGoal = async (instance: InstanceWithProgress) => {
    if (!profile || instance.completed) return;
    const gemsPerGoal = profile.streak_count >= 5 ? 2 : 1;

    await supabase.from('daily_goal_instances').update({
      completed: true,
      completed_at: new Date().toISOString(),
      gems_earned: gemsPerGoal,
    }).eq('id', instance.id);

    await supabase.from('profiles').update({
      gem_balance: profile.gem_balance + gemsPerGoal,
      total_gems_earned: profile.total_gems_earned + gemsPerGoal,
      total_goals_completed: (profile.total_goals_completed ?? 0) + 1,
      last_active_date: today,
    }).eq('id', user?.id);

    // Increment character trait for this goal's category
    await handleTraitIncrement(instance.goal_id);

    await loadTodayInstances();
    await refreshProfile();

    const earned = await checkAndAwardAchievements(user!.id);
    if (earned.length > 0) {
      setNewAchievement(`🏆 Achievement unlocked: ${earned[0].title} ${earned[0].emoji}`);
      setTimeout(() => setNewAchievement(null), 4000);
    }
  };

  // Progress goal — add increment
  const addProgress = async (instance: InstanceWithProgress, goal: GoalWithProgress) => {
    if (!profile || instance.completed) return;

    const incrementStr = incrementInputs[instance.id] || '1';
    const increment = parseFloat(incrementStr);
    if (isNaN(increment) || increment <= 0) return;

    const currentProgress = instance.progress_value ?? 0;
    const target = goal.target_value ?? 1;
    const newProgress = Math.min(currentProgress + increment, target);
    const isNowComplete = newProgress >= target;
    const gemsPerGoal = profile.streak_count >= 5 ? 2 : 1;

    await supabase.from('daily_goal_instances').update({
      progress_value: newProgress,
      completed: isNowComplete,
      completed_at: isNowComplete ? new Date().toISOString() : null,
      gems_earned: isNowComplete ? gemsPerGoal : 0,
    }).eq('id', instance.id);

    if (isNowComplete) {
      await supabase.from('profiles').update({
        gem_balance: profile.gem_balance + gemsPerGoal,
        total_gems_earned: profile.total_gems_earned + gemsPerGoal,
        total_goals_completed: (profile.total_goals_completed ?? 0) + 1,
        last_active_date: today,
      }).eq('id', user?.id);

      // Increment character trait for this goal's category
      await handleTraitIncrement(instance.goal_id);

      await refreshProfile();

      const earned = await checkAndAwardAchievements(user!.id);
      if (earned.length > 0) {
        setNewAchievement(`🏆 Achievement unlocked: ${earned[0].title} ${earned[0].emoji}`);
        setTimeout(() => setNewAchievement(null), 4000);
      }
    }

    setIncrementInputs(prev => ({ ...prev, [instance.id]: '' }));
    setShowIncrementFor(null);
    await loadTodayInstances();
  };

  const completedCount = todayInstances.filter(i => i.completed).length;
  const isHotStreak = profile && profile.streak_count >= 5;

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {newAchievement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-slate-900 font-semibold px-6 py-3 rounded-full shadow-lg animate-bounce">
          {newAchievement}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Today's Goals</h2>
            <p className="text-slate-600 text-sm">{completedCount} of {todayInstances.length} completed</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Flame className={`w-5 h-5 ${isHotStreak ? 'text-orange-500' : 'text-slate-400'}`} />
              <span className="text-lg font-bold text-slate-900">{profile?.streak_count}</span>
            </div>
            {isHotStreak && <div className="text-xs font-medium text-orange-600">Hot Streak! +1 gem/goal</div>}
          </div>
        </div>

        <div className="space-y-3">
          {todayInstances.length === 0 && goals.length === 0 && (
            <div className="text-center py-8 text-slate-500">No goals yet. Add your first goal to get started!</div>
          )}

          {goals.map(goal => {
            const instance = todayInstances.find(i => i.goal_id === goal.id) as InstanceWithProgress | undefined;
            if (!instance) return null;
            const isCompleted = instance.completed;
            const isEditing = editingGoalId === goal.id;
            const isProgress = goal.goal_type === 'progress';
            const progress = instance.progress_value ?? 0;
            const target = goal.target_value ?? 1;
            const pct = Math.min((progress / target) * 100, 100);
            const isShowingIncrement = showIncrementFor === instance.id;

            return (
              <div key={goal.id} className={`p-4 rounded-lg border-2 transition-all ${
                isCompleted ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-3">
                  {/* Tick — only for simple goals */}
                  {!isProgress && (
                    <button onClick={() => completeSimpleGoal(instance)} disabled={isCompleted}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isCompleted ? 'bg-green-500 border-green-500 cursor-default' : 'border-slate-300 hover:border-slate-400'
                      }`}>
                      {isCompleted && <Check className="w-4 h-4 text-white" />}
                    </button>
                  )}

                  {/* Progress check indicator */}
                  {isProgress && (
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-300'
                    }`}>
                      {isCompleted && <Check className="w-4 h-4 text-white" />}
                    </div>
                  )}

                  {/* Title */}
                  <div className="flex-1">
                    {isEditing ? (
                      <input type="text" value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(goal.id)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                        autoFocus maxLength={100} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {goal.title}
                        </p>
                        {/* Show detected category badge */}
                        {goal.category && goal.category !== 'general' && (
                          <span className="text-xs text-slate-400">
                            {['fitness','reading','mindfulness','creativity','sleep','nutrition'].includes(goal.category)
                              ? { fitness:'💪', reading:'📚', mindfulness:'🧘', creativity:'🎨', sleep:'😴', nutrition:'🥗' }[goal.category as string]
                              : null}
                          </span>
                        )}
                      </div>
                    )}
                    {isProgress && !isEditing && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {progress}{goal.unit ? ` ${goal.unit}` : ''} / {target}{goal.unit ? ` ${goal.unit}` : ''}
                      </p>
                    )}
                    {!isProgress && goal.is_recurring && !isEditing && (
                      <p className="text-xs text-slate-500">Recurring</p>
                    )}
                  </div>

                  {/* Gems earned */}
                  {isCompleted && (
                    <div className="text-sm font-medium text-green-600">+{instance.gems_earned} gem{instance.gems_earned > 1 ? 's' : ''}</div>
                  )}

                  {/* + button for progress goals */}
                  {isProgress && !isCompleted && (
                    <button onClick={() => setShowIncrementFor(isShowingIncrement ? null : instance.id)}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  )}

                  {/* Edit / Delete for non-completed goals */}
                  {!isCompleted && (
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <button onClick={() => saveEdit(goal.id)} className="text-green-500 hover:text-green-700 transition-colors">
                          <Save className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => startEditing(goal)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteGoal(goal.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {isProgress && (
                  <div className="mt-3">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {/* Increment input */}
                {isShowingIncrement && !isCompleted && (
                  <div className="mt-3 flex gap-2 items-center">
                    <input
                      type="number"
                      value={incrementInputs[instance.id] || ''}
                      onChange={e => setIncrementInputs(prev => ({ ...prev, [instance.id]: e.target.value }))}
                      placeholder={`Add ${goal.unit || 'amount'}...`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.1" step="0.1"
                      onKeyDown={e => e.key === 'Enter' && addProgress(instance, goal)}
                      autoFocus
                    />
                    <button onClick={() => addProgress(instance, goal)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                      Add
                    </button>
                    <button onClick={() => setShowIncrementFor(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add goal button */}
        {canAddMore && !showAddGoal && (
          <button onClick={() => setShowAddGoal(true)}
            className="w-full mt-4 py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Add Goal ({totalGoalsToday}/5)</span>
          </button>
        )}

        {!canAddMore && (
          <div className="w-full mt-4 py-3 px-4 bg-slate-50 rounded-lg text-center text-slate-500 text-sm">
            🔒 Daily limit reached (5/5) — come back tomorrow!
          </div>
        )}

        {/* Add goal form */}
        {showAddGoal && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
            <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goalType === 'simple' && createGoal()}
              placeholder="Enter your goal..." maxLength={100} autoFocus
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900" />

            {/* Live category preview */}
            {newGoalTitle.trim() && (
              <p className="text-xs text-slate-500">
                Detected category:{' '}
                <span className="font-medium text-slate-700">
                  {{ fitness:'💪 Fitness', reading:'📚 Reading', mindfulness:'🧘 Mindfulness',
                     creativity:'🎨 Creativity', sleep:'😴 Sleep', nutrition:'🥗 Nutrition',
                     general:'⚪ General' }[detectCategory(newGoalTitle)] ?? 'General'}
                </span>
              </p>
            )}

            {/* Goal type toggle */}
            <div className="flex gap-2">
              <button onClick={() => setGoalType('simple')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${goalType === 'simple' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                ✅ Simple
              </button>
              <button onClick={() => setGoalType('progress')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${goalType === 'progress' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                📊 Progress
              </button>
            </div>

            {/* Progress fields */}
            {goalType === 'progress' && (
              <div className="flex gap-2">
                <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                  placeholder="Target (e.g. 4)" min="1" step="0.1"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                  placeholder="Unit (e.g. L, km)" maxLength={10}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
              <span className="text-slate-700">Recurring daily</span>
            </label>

            <div className="flex gap-2">
              <button onClick={createGoal}
                disabled={!newGoalTitle.trim() || (goalType === 'progress' && (!targetValue || parseFloat(targetValue) <= 0))}
                className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Add Goal
              </button>
              <button onClick={() => { setShowAddGoal(false); setNewGoalTitle(''); setTargetValue(''); setUnit(''); setGoalType('simple'); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-100 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-2">How it works</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Add up to 5 goals per day</li>
          <li>• <strong>Simple</strong> goals — just tick when done</li>
          <li>• <strong>Progress</strong> goals — tap + to log your progress</li>
          <li>• Each completed goal = {isHotStreak ? '2 gems (Hot Streak! 🔥)' : '1 gem'}</li>
          <li>• Completing goals evolves your character 🧬</li>
          <li>• Completed goals are locked — no cheating! 😄</li>
          <li>• Maintain a 5-day streak for bonus rewards</li>
        </ul>
      </div>
    </div>
  );
}
