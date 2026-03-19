import { useState, useEffect } from 'react';
import { Zap, CheckCircle, Clock, Gem, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DailyChallenge,
  WeeklyChallenge,
  getTodaysChallenges,
  getWeeklyChallenges,
  getUserCompletionsToday,
  getUserWeeklyCompletions,
  completeDaily,
  completeWeekly,
} from '../lib/challenges';

type Tab = 'daily' | 'weekly';

export function ChallengesView() {
  const { user, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('daily');

  // Daily state
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [dailyCompletedIds, setDailyCompletedIds] = useState<Set<string>>(new Set());
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyClaiming, setDailyClaiming] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  // Weekly state
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallenge[]>([]);
  const [weeklyCompletedIds, setWeeklyCompletedIds] = useState<Set<string>>(new Set());
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyClaiming, setWeeklyClaiming] = useState<string | null>(null);
  const [weeklyMessage, setWeeklyMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (user) {
      loadDaily();
      loadWeekly();
    }
  }, [user]);

  const loadDaily = async () => {
    const [challenges, completions] = await Promise.all([
      getTodaysChallenges(),
      getUserCompletionsToday(user!.id),
    ]);
    setDailyChallenges(challenges);
    setDailyCompletedIds(new Set(completions.map(c => c.challenge_id)));
    setDailyLoading(false);
  };

  const loadWeekly = async () => {
    const [challenges, completions] = await Promise.all([
      getWeeklyChallenges(),
      getUserWeeklyCompletions(user!.id),
    ]);
    setWeeklyChallenges(challenges);
    setWeeklyCompletedIds(new Set(completions.map(c => c.challenge_id)));
    setWeeklyLoading(false);
  };

  const handleClaimDaily = async (challenge: DailyChallenge) => {
    if (!user || dailyCompletedIds.has(challenge.id)) return;
    setDailyClaiming(challenge.id);
    const result = await completeDaily(user.id, challenge);
    setDailyMessage({ id: challenge.id, text: result.message, success: result.success });
    setTimeout(() => setDailyMessage(null), 3000);
    if (result.success) {
      setDailyCompletedIds(new Set([...dailyCompletedIds, challenge.id]));
      await refreshProfile();
    }
    setDailyClaiming(null);
  };

  const handleClaimWeekly = async (challenge: WeeklyChallenge) => {
    if (!user || weeklyCompletedIds.has(challenge.id)) return;
    setWeeklyClaiming(challenge.id);
    const result = await completeWeekly(user.id, challenge);
    setWeeklyMessage({ id: challenge.id, text: result.message, success: result.success });
    setTimeout(() => setWeeklyMessage(null), 3000);
    if (result.success) {
      setWeeklyCompletedIds(new Set([...weeklyCompletedIds, challenge.id]));
      await refreshProfile();
    }
    setWeeklyClaiming(null);
  };

  const getTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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
    complete_all_goals: '✅',
    streak: '🔥',
    place_building: '🏗️',
    place_buildings: '🏗️',
    goals_days: '📅',
    gems_earned: '💎',
  };

  const renderChallengeCard = (
    challenge: DailyChallenge | WeeklyChallenge,
    isCompleted: boolean,
    isClaiming: boolean,
    currentMessage: { id: string; text: string; success: boolean } | null,
    onClaim: () => void,
    isWeekly: boolean
  ) => (
    <div
      key={challenge.id}
      className={`bg-white rounded-xl border-2 p-5 transition-all ${
        isCompleted ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="text-3xl">
            {isCompleted ? '✅' : challengeTypeIcon[challenge.challenge_type] ?? '⚡'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-base font-bold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                {challenge.title}
              </h3>
              {isWeekly && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  Weekly
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm mb-2">{challenge.description}</p>
            <div className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
              <Gem className="w-4 h-4" />
              <span>+{challenge.gem_reward} gems</span>
              {isWeekly && <span className="text-purple-600 text-xs ml-1">🏆 bonus!</span>}
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
              onClick={onClaim}
              disabled={isClaiming}
              className={`text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isWeekly
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600'
                  : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600'
              }`}
            >
              {isClaiming ? 'Checking...' : 'Claim'}
            </button>
          )}
        </div>
      </div>

      {currentMessage && currentMessage.id === challenge.id && (
        <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
          currentMessage.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {currentMessage.text}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-7 h-7 text-yellow-500" />
          <h2 className="text-2xl font-bold text-slate-900">Challenges</h2>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${
              tab === 'daily' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Daily
          </button>
          <button
            onClick={() => setTab('weekly')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${
              tab === 'weekly' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Weekly
          </button>
        </div>
      </div>

      {/* Daily tab */}
      {tab === 'daily' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-600 text-sm font-medium">
              {dailyCompletedIds.size}/{dailyChallenges.length} completed today
            </p>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>Resets in {getTimeUntilMidnight()}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${dailyChallenges.length > 0 ? (dailyCompletedIds.size / dailyChallenges.length) * 100 : 0}%` }}
            />
          </div>

          {dailyLoading ? (
            <div className="text-center py-8 text-slate-600">Loading...</div>
          ) : dailyChallenges.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No challenges today</h3>
              <p className="text-slate-500 text-sm">Check back tomorrow!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyChallenges.map(challenge =>
                renderChallengeCard(
                  challenge,
                  dailyCompletedIds.has(challenge.id),
                  dailyClaiming === challenge.id,
                  dailyMessage,
                  () => handleClaimDaily(challenge),
                  false
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Weekly tab */}
      {tab === 'weekly' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-600 text-sm font-medium">
              {weeklyCompletedIds.size}/{weeklyChallenges.length} completed this week
            </p>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>Resets in {getTimeUntilMonday()}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-400 to-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${weeklyChallenges.length > 0 ? (weeklyCompletedIds.size / weeklyChallenges.length) * 100 : 0}%` }}
            />
          </div>

          {weeklyLoading ? (
            <div className="text-center py-8 text-slate-600">Loading...</div>
          ) : weeklyChallenges.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No weekly challenges yet</h3>
              <p className="text-slate-500 text-sm">New challenges drop every Monday!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyChallenges.map(challenge =>
                renderChallengeCard(
                  challenge,
                  weeklyCompletedIds.has(challenge.id),
                  weeklyClaiming === challenge.id,
                  weeklyMessage,
                  () => handleClaimWeekly(challenge),
                  true
                )
              )}
            </div>
          )}
        </>
      )}

      {/* How it works */}
      <div className="bg-slate-100 rounded-xl p-6 mt-6">
        <h3 className="font-semibold text-slate-900 mb-2">How challenges work</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>⚡ <strong>Daily</strong> — 3 challenges reset every midnight</li>
          <li>🏆 <strong>Weekly</strong> — 3 bigger challenges reset every Monday</li>
          <li>💎 Complete the requirement first, then click Claim</li>
          <li>🎯 Weekly challenges give bigger gem rewards!</li>
        </ul>
      </div>
    </div>
  );
}
