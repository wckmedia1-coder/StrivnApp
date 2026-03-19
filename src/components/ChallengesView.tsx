import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Gem, Calendar, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  WeeklyChallenge,
  getWeeklyChallenges,
  getUserWeeklyCompletions,
  completeWeekly,
} from '../lib/challenges';

export function ChallengesView() {
  const { user, refreshProfile } = useAuth();
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (user) loadChallenges();
  }, [user]);

  const loadChallenges = async () => {
    const [challengeData, completionData] = await Promise.all([
      getWeeklyChallenges(),
      getUserWeeklyCompletions(user!.id),
    ]);
    setChallenges(challengeData);
    setCompletedIds(new Set(completionData.map(c => c.challenge_id)));
    setLoading(false);
  };

  const handleClaim = async (challenge: WeeklyChallenge) => {
    if (!user || completedIds.has(challenge.id)) return;
    setClaiming(challenge.id);
    const result = await completeWeekly(user.id, challenge);
    setMessage({ id: challenge.id, text: result.message, success: result.success });
    setTimeout(() => setMessage(null), 3000);
    if (result.success) {
      setCompletedIds(new Set([...completedIds, challenge.id]));
      await refreshProfile();
    }
    setClaiming(null);
  };

  const getTimeUntilMonday = () => {
    const now = new Date();
    const monday = new Date();
    const daysUntilMonday = (8 - monday.getDay()) % 7 || 7;
    monday.setDate(monday.getDate() + daysUntilMonday);
    monday.setHours(0, 0, 0, 0);
    const diff = monday.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  };

  const challengeTypeIcon: Record<string, string> = {
    goals_days: '📅',
    gems_earned: '💎',
    place_buildings: '🏗️',
    streak: '🔥',
    complete_all_goals: '✅',
    complete_goals_count: '🎯',
  };

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-purple-500" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Weekly Challenges</h2>
              <p className="text-slate-500 text-sm">{completedIds.size} of {challenges.length} completed this week</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>{getTimeUntilMonday()}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-400 to-indigo-500 h-3 rounded-full transition-all"
            style={{ width: `${challenges.length > 0 ? (completedIds.size / challenges.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Challenges */}
      {challenges.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No challenges this week</h3>
          <p className="text-slate-500 text-sm">New challenges drop every Monday!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map(challenge => {
            const isCompleted = completedIds.has(challenge.id);
            const isClaiming = claiming === challenge.id;
            const currentMessage = message?.id === challenge.id ? message : null;

            return (
              <div
                key={challenge.id}
                className={`bg-white rounded-xl border-2 p-5 transition-all ${
                  isCompleted ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">
                      {isCompleted ? '✅' : challengeTypeIcon[challenge.challenge_type] ?? '⚡'}
                    </div>
                    <div>
                      <h3 className={`text-base font-bold mb-1 ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {challenge.title}
                      </h3>
                      <p className="text-slate-500 text-sm mb-3">{challenge.description}</p>
                      <div className="flex items-center gap-1 text-purple-600 font-semibold text-sm">
                        <Gem className="w-4 h-4" />
                        <span>+{challenge.gem_reward} gems</span>
                        <span className="text-xs text-slate-400 ml-1">weekly bonus</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                        <CheckCircle className="w-5 h-5" />
                        <span>Done!</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaim(challenge)}
                        disabled={isClaiming}
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isClaiming ? 'Checking...' : 'Claim'}
                      </button>
                    )}
                  </div>
                </div>

                {currentMessage && (
                  <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    currentMessage.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {currentMessage.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <div className="bg-slate-100 rounded-xl p-6 mt-6">
        <h3 className="font-semibold text-slate-900 mb-2">How it works</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>🏆 3 new challenges drop every Monday</li>
          <li>💎 Complete the requirement then click Claim</li>
          <li>🎯 Weekly challenges give bigger gem rewards than goals</li>
          <li>⏰ Challenges reset every Monday at midnight</li>
        </ul>
      </div>
    </div>
  );
}
