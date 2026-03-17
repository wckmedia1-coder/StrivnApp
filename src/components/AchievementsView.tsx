import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Achievement, getUserAchievements, getAllAchievements } from '../lib/achievements';

type EarnedAchievement = Achievement & { earned_at: string };

const categoryLabels: Record<string, string> = {
  streak: '🔥 Streak',
  gems: '💎 Gems',
  city: '🏙️ City',
  goals: '✅ Goals',
};

export function AchievementsView() {
  const { user } = useAuth();
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [all, setAll] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadAchievements();
  }, [user]);

  const loadAchievements = async () => {
    const [earnedData, allData] = await Promise.all([
      getUserAchievements(user!.id),
      getAllAchievements(),
    ]);
    setEarned(earnedData);
    setAll(allData);
    setLoading(false);
  };

  const earnedIds = new Set(earned.map((e) => e.id));
  const categories = ['streak', 'gems', 'city', 'goals'];

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-7 h-7 text-yellow-500" />
          <h2 className="text-2xl font-bold text-slate-900">Achievements</h2>
        </div>
        <p className="text-slate-500 text-sm">
          {earned.length} of {all.length} unlocked
        </p>
        <div className="mt-4 bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all"
            style={{ width: `${all.length > 0 ? (earned.length / all.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {categories.map((category) => {
        const categoryAchievements = all.filter((a) => a.category === category);
        return (
          <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {categoryLabels[category]}
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {categoryAchievements.map((achievement) => {
                const isEarned = earnedIds.has(achievement.id);
                const earnedEntry = earned.find((e) => e.id === achievement.id);
                return (
                  <div
                    key={achievement.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      isEarned
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="text-3xl">
                      {isEarned ? achievement.emoji : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${isEarned ? 'text-slate-900' : 'text-slate-500'}`}>
                        {achievement.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{achievement.description}</p>
                      {isEarned && earnedEntry && (
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Earned {new Date(earnedEntry.earned_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
