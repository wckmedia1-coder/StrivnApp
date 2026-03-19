import { useState, useEffect } from 'react';
import { Plus, Check, Flame, X, Pencil, Save } from 'lucide-react';
import { supabase, Goal, DailyGoalInstance } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkAndAwardAchievements } from '../lib/achievements';

export function GoalsView() {
  const { user, profile, refreshProfile } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todayInstances, setTodayInstances] = useState<DailyGoalInstance[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Count how many goals were created today
  const goalsCreatedToday = goals.filter(g => g.created_at?.split('T')[0] === today).length;
  const totalGoalsToday = todayInstances.length;
  const canAddMore = totalGoalsToday < 5;

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

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user?.id,
        title: newGoalTitle.trim(),
        is_recurring: isRecurring,
      })
      .select()
      .single();

    if (data && !error) {
      setGoals([...goals, data]);
      setNewGoalTitle('');
      setShowAddGoal(false);

      await supabase.from('daily_goal_instances').insert({
        goal_id: data.id,
        user_id: user?.id,
        date: today,
        completed: false,
      });

      await loadTodayInstances();
    }
  };

  const deleteGoal = async (goalId: string) => {
    // Check if this goal is completed today — if so, block deletion
    const instance = todayInstances.find(i => i.goal_id === goalId);
    if (instance?.completed) return;

    await supabase.from('goals').update({ is_active: false }).eq('id', goalId);
    setGoals(goals.filter(g => g.id !== goalId));
    setTodayInstances(todayInstances.filter(i => i.goal_id !== goalId));
  };

  const startEditing = (goal: Goal) => {
    const instance = todayInstances.find(i => i.goal_id === goal.id);
    if (instance?.completed) return; // can't edit completed goals
    setEditingGoalId(goal.id);
    setEditingTitle(goal.title);
  };

  const saveEdit = async (goalId: string) => {
    if (!editingTitle.trim()) return;
    await supabase.from('goals').update({ title: editingTitle.trim() }).eq('id', goalId);
    setGoals(goals.map(g => g.id === goalId ? { ...g, title: editingTitle.trim() } : g));
    setEditingGoalId(null);
    setEditingTitle('');
  };

  const toggleGoalCompletion = async (instance: DailyGoalInstance) => {
    if (!profile) return;

    // Once completed, it's locked — can't untick
    if (instance.completed) return;

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

    await loadTodayInstances();
    await refreshProfile();

    const earned = await checkAndAwardAchievements(user!.id);
    if (earned.length > 0) {
      setNewAchievement(`🏆 Achievement unlocked: ${earned[0].title} ${earned[0].emoji}`);
      setTimeout(() => setNewAchievement(null), 4000);
    }
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
            <p className="text-slate-600 text-sm">
              {completedCount} of {todayInstances.length} completed
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Flame className={`w-5 h-5 ${isHotStreak ? 'text-orange-500' : 'text-slate-400'}`} />
              <span className="text-lg font-bold text-slate-900">{profile?.streak_count}</span>
            </div>
            {isHotStreak && (
              <div className="text-xs font-medium text-orange-600">Hot Streak! +1 gem/goal</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {todayInstances.length === 0 && goals.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No goals yet. Add your first goal to get started!
            </div>
          )}

          {goals.map(goal => {
            const instance = todayInstances.find(i => i.goal_id === goal.id);
            if (!instance) return null;
            const isCompleted = instance.completed;
            const isEditing = editingGoalId === goal.id;

            return (
              <div key={goal.id} className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                isCompleted ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                {/* Completion circle — clicking does nothing once completed */}
                <button
                  onClick={() => toggleGoalCompletion(instance)}
                  disabled={isCompleted}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 cursor-default'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {isCompleted && <Check className="w-4 h-4 text-white" />}
                </button>

                {/* Title — editable if not completed */}
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(goal.id)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      autoFocus
                      maxLength={100}
                    />
                  ) : (
                    <p className={`font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {goal.title}
                    </p>
                  )}
                  {goal.is_recurring && !isEditing && (
                    <p className="text-xs text-slate-500">Recurring</p>
                  )}
                </div>

                {/* Gems earned */}
                {isCompleted && (
                  <div className="text-sm font-medium text-green-600">
                    +{instance.gems_earned} gem{instance.gems_earned > 1 ? 's' : ''}
                  </div>
                )}

                {/* Edit / Save / Delete — only if not completed */}
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
            );
          })}
        </div>

        {/* Add goal — blocked if 5 already exist today */}
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

        {showAddGoal && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <input
              type="text"
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGoal()}
              placeholder="Enter your goal..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
              autoFocus
              maxLength={100}
            />
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
              <span className="text-slate-700">Recurring daily</span>
            </label>
            <div className="flex gap-2">
              <button onClick={createGoal} disabled={!newGoalTitle.trim()}
                className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Add Goal
              </button>
              <button onClick={() => { setShowAddGoal(false); setNewGoalTitle(''); }} className="px-4 py-2 text-slate-600 hover:text-slate-900">
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
          <li>• Each goal = {isHotStreak ? '2 gems (Hot Streak! 🔥)' : '1 gem'}</li>
          <li>• Completed goals are locked — no cheating! 😄</li>
          <li>• Maintain a 5-day streak for bonus rewards</li>
          <li>• Use gems to build your city</li>
          <li>• Missing a day causes city decay</li>
        </ul>
      </div>
    </div>
  );
}
