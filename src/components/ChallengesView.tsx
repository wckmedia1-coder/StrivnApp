import { useState, useEffect } from 'react';
import { Zap, CheckCircle, Clock, Gem } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DailyChallenge,
  getTodaysChallenges,
  getUserCompletionsToday,
  completeChallenge,
} from '../lib/challenges';

export function ChallengesView() {
  const { user, refreshProfile } = useAuth();
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (user) loadChallenges();
  }, [user]);

  const loadChallenges = async () => {
    const [challengesData, completionsData] = await Promise.all([
      getTodaysChallenges(),
      getUserCompletionsToday(user!.id),
    ]);

    setChallenges(challengesData);
    setCompletedIds(new Set(completionsData.map((c) => c.challenge_id)));
    setLoading(false);
  };

  const handleClaim = async (challenge: DailyChallenge) => {
    if (!user || completedIds.has(challenge.id)) return;

    setClaiming(challenge.id);
    const result = await completeChallenge(user.id, challenge);

    setMessage({ id: challenge.id, text: result.message, success: result.success });
    setTimeout(() => setMessage(null), 3000);

    if (result.success) {
      setCompletedIds(new Set([...completedIds, challenge.id]));
      await refreshProfile();
    }

    setClaiming(null);
  };

  const getTimeUntilReset = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const challengeTypeIcon: Record<string, string> = {
    complete_all_goals: '✅',
    streak: '🔥',
    place_building: '🏗️',
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Zap className="w-7 h-7 text-yellow-500" />
            <h2 className="text-2xl font-bold text-slate-900">Daily Challenges</h2>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>Resets in {getTimeUntilReset()}</span>
          </div>
        </div>
        <p className="text-slate-500 text-sm">
          {completedIds.size} of {challenges.length} completed today
        </p>
        <div className="mt-4 bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all"
            style={{
              width: `${challenges.length > 0 ? (completedIds.size / challenges.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {challenges.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No challenges today</h3>
          <p className="text-slate-500 text-sm">Check back tomorrow for new challenges!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge) => {
            const isCompleted = completedIds.has(challenge.id);
            const isClaiming = claiming === challenge.id;
            const currentMessage = message?.id === challenge.id ? message : null;

            return (
              <div
                key={challenge.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all ${
                  isCompleted
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">
                      {isCompleted ? '✅' : challengeTypeIcon[challenge.challenge_type] ?? '⚡'}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold mb-1 ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {challenge.title}
                      </h3>
                      <p className="text-slate-500 text-sm mb-3">{challenge.description}</p>
                      <div className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
                        <Gem className="w-4 h-4" />
                        <span>+{challenge.gem_reward} gems</span>
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
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isClaiming ? 'Checking...' : 'Claim'}
                      </button>
                    )}
                  </div>
                </div>

                {currentMessage && (
                  <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    currentMessage.success
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {currentMessage.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-100 rounded-xl p-6 mt-6">
        <h3 className="font-semibold text-slate-900 mb-2">How challenges work</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• New challenges appear every day</li>
          <li>• Complete the requirement first, then click Claim</li>
          <li>• Bonus gems are added to your balance instantly</li>
          <li>• Challenges reset at midnight every night</li>
        </ul>
      </div>
    </div>
  );
}
