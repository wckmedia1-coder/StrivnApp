import { useState, useEffect } from 'react';
import { Flame, Zap, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Challenge = {
  id: string;
  title: string;
  gem_reward: number;
};

const quotes = [
  "Small steps every day lead to big changes over time.",
  "The secret of getting ahead is getting started.",
  "You don't have to be great to start, but you have to start to be great.",
  "Consistency is the key to achieving and maintaining momentum.",
  "Every day is a new opportunity to grow and be better.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Your future is created by what you do today, not tomorrow.",
  "Believe in yourself and all that you are.",
  "Push yourself because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Stay focused and never give up.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getCityWeather(streakCount: number): { emoji: string; label: string; color: string } {
  if (streakCount === 0) return { emoji: '🌧️', label: 'Stormy', color: 'from-slate-600 to-slate-800' };
  if (streakCount < 3) return { emoji: '⛅', label: 'Cloudy', color: 'from-slate-500 to-blue-700' };
  if (streakCount < 7) return { emoji: '🌤️', label: 'Clearing Up', color: 'from-blue-500 to-blue-700' };
  if (streakCount < 14) return { emoji: '☀️', label: 'Sunny', color: 'from-yellow-400 to-orange-500' };
  if (streakCount < 30) return { emoji: '🌈', label: 'Glorious', color: 'from-pink-500 to-purple-600' };
  return { emoji: '✨', label: 'Legendary', color: 'from-purple-500 to-indigo-600' };
}

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const BRIEFING_KEY = 'strivn_last_briefing';

export function DailyBriefing({ onDismiss }: { onDismiss: () => void }) {
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [todayGoalsCount, setTodayGoalsCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadData();
    // Animate in
    setTimeout(() => setVisible(true), 50);
  }, []);

  const loadData = async () => {
    if (!profile) return;
    const today = getLocalDateString();

    // Load today's challenges
    const { data: challengeData } = await supabase
      .from('daily_challenges')
      .select('id, title, gem_reward')
      .eq('challenge_date', today)
      .limit(3);
    if (challengeData) setChallenges(challengeData);

    // Load today's goal count
    const { count } = await supabase
      .from('daily_goal_instances')
      .select('id', { count: 'exact' })
      .eq('user_id', profile.id)
      .eq('date', today);
    setTodayGoalsCount(count ?? 0);
  };

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!profile) return null;

  const greeting = getGreeting();
  const weather = getCityWeather(profile.streak_count);
  const quote = quotes[new Date().getDate() % quotes.length];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>

      <div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>

        {/* Header with gradient */}
        <div className={`bg-gradient-to-br ${weather.color} p-8 text-white text-center relative`}>
          <div className="text-6xl mb-3">{weather.emoji}</div>
          <p className="text-white/80 text-sm font-medium mb-1">{today}</p>
          <h1 className="text-3xl font-bold mb-1">{greeting},</h1>
          <h2 className="text-2xl font-bold">{profile.username}! 👋</h2>
          <p className="text-white/70 text-sm mt-2">City weather: {weather.label}</p>
        </div>

        {/* Body */}
        <div className="bg-white p-6 space-y-4">

          {/* Quote */}
          <div className="bg-slate-50 rounded-xl p-4 border-l-4 border-slate-900">
            <p className="text-slate-700 text-sm italic">"{quote}"</p>
          </div>

          {/* Streak */}
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              <div>
                <p className="font-bold text-slate-900 text-lg">{profile.streak_count} day streak</p>
                <p className="text-xs text-slate-500">
                  {profile.streak_count === 0
                    ? 'Start your streak today!'
                    : profile.streak_count < 7
                    ? 'Keep it going!'
                    : profile.streak_count < 30
                    ? 'You\'re on fire! 🔥'
                    : 'Absolutely legendary! 🏆'}
                </p>
              </div>
            </div>
            {profile.streak_count >= 5 && (
              <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                +1 gem bonus!
              </div>
            )}
          </div>

          {/* Today's goals */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-100">
            <div>
              <p className="font-semibold text-slate-900">Today's Goals</p>
              <p className="text-xs text-slate-500">
                {todayGoalsCount === 0
                  ? 'No goals set yet — add some!'
                  : `${todayGoalsCount} goal${todayGoalsCount > 1 ? 's' : ''} waiting for you`}
              </p>
            </div>
            <div className="text-2xl">{todayGoalsCount === 0 ? '📝' : '✅'}</div>
          </div>

          {/* Challenges */}
          {challenges.length > 0 && (
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <p className="font-semibold text-slate-900 text-sm">Today's Challenges</p>
              </div>
              <div className="space-y-1">
                {challenges.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">{c.title}</p>
                    <p className="text-xs font-bold text-yellow-600">+{c.gem_reward} 💎</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Let's Go button */}
          <button
            onClick={handleDismiss}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors"
          >
            Let's Go! 🚀
          </button>

          <button onClick={handleDismiss} className="w-full text-slate-400 text-sm hover:text-slate-600 transition-colors">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
