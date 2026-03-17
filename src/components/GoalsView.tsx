import { useState, useEffect } from 'react';
import { Plus, Check, Flame, X } from 'lucide-react';
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

  const today = new Date().toISOString().split('T')[0];

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
    if (!newGoalTitle.trim() || goals.length >= 5) return;

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

      await supabase
        .from('daily_goal_instances')
        .insert({
          goal_id: data.id,
          user_id: user?.id,
          date: today,
          completed: false,
        });

      await loadTodayInstances();
    }
  };

  const deleteGoal = async (goalId: string) => {
    await supabase
      .from('goals')
      .update({ is_active: false })
      .eq('id', goalId);

    setGoals(goals.filter((g) => g.id !== goalId));
    setTodayInstances(todayInstances.filter((i) => i.goal_id !== goalId));
  };

  const toggleGoalCompletion = async (instance: DailyGoalInstance) => {
    if (!profile) return;

    const newCompleted = !instance.completed;
    const gemsPerGoal = profile.streak_count >= 5 ? 2 : 1;
    const gemChange = newCompleted ? gemsPerGoal : -instance.gems_earned;

    await supabase
      .from('daily_goal_instances')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
        gems_earned: newCompleted ? gemsPerGoal : 0,
      })
      .eq('id', instance.id);

    const newBalance = profile.gem_balance + gemChange;
    const newTotalEarned = newCompleted
      ? profile.total_gems_earned + gemsPerGoal
      : profile.total_gems_earned - instance.gems_earned;

    const newTotalCompleted = newCompleted
      ? (profile.total_goals_completed ?? 0) + 1
      : (profile.total_goals_completed ?? 0) - 1;

    await supabase
      .from('profiles')
      .update({
        gem_balance: newBalance,
        total_gems_earned: newTotalEarned,
        total_goals_completed: newTotalCompleted,
        last_active_date: today,
      })
      .eq('id', user?.id);

    await loadTodayInstances();
    await refreshProfile();

    if (newCompleted) {
      const earned = await checkAndAwardAchievements(user!.id);
      if (earned.length > 0) {
        setNewAchievement(`🏆 Achievement unlocked: ${earned[0].title} ${earned[0].emoji}`);
        setTimeout(() => setNewAchievement(null), 4000);
      }
    }
  };

  const completedCount = todayInstances.filter((i) => i.completed).length;
  const isHotStreak = profile && profile.streak_count >= 5;

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

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

          {goals.map((goal) => {
            const instance = todayInstances.find((i) => i.goal_id === goal.id);
            if (!instance) return null;

            return (
              <div
                key={goal.id}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  instance.completed
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => toggleGoalCompletion(instance)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    instance.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {instance.completed && <Check className="w-4 h-4 text-white" />}
                </button>

                <div className="flex-1">
                  <p className={`font-medium ${instance.completed ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                    {goal.title}
                  </p>
                  {goal.is_recurring && (
                    <p className="text-xs text-slate-500">Recurring</p>
                  )}
                </div>

                {instance.completed && (
                  <div className="text-sm font-medium text-green-600">
                    +{instance.gems_earned} gem{instance.gems_earned > 1 ? 's' : ''}
                  </div>
                )}

                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>

        {goals.length < 5 && !showAddGoal && (
          <button
            onClick={() => setShowAddGoal(true)}
            className="w-full mt-4 py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Goal ({goals.length}/5)</span>
          </button>
        )}

        {showAddGoal && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="Enter your goal..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
              autoFocus
              maxLength={100}
            />

            <label className="flex items-center gap-2 mb-3 text-sm">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded"
              />
              <span className="text-slate-700">Recurring daily</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={createGoal}
                disabled={!newGoalTitle.trim()}
                className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Goal
              </button>
              <button
                onClick={() => {
                  setShowAddGoal(false);
                  setNewGoalTitle('');
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-100 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-2">How it works</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Complete goals to earn gems</li>
          <li>• Each goal = {isHotStreak ? '2 gems (Hot Streak! 🔥)' : '1 gem'}</li>
          <li>• Maintain a 5-day streak for bonus rewards</li>
          <li>• Use gems to build your city</li>
          <li>• Missing a day causes city decay</li>
        </ul>
      </div>
    </div>
  );
}
