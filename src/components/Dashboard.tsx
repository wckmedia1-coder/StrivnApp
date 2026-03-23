import { useState, useEffect } from 'react';
import { Home, User, Users, LogOut, Gem, Trophy, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoalsView } from './GoalsView';
import { CharacterView } from './CharacterView';
import { SocialView } from './SocialView';
import { ProfileView } from './ProfileView';
import { AchievementsView } from './AchievementsView';
import { ChallengesView } from './ChallengesView';
import { DailyBriefing } from './DailyBriefing';

type View = 'goals' | 'character' | 'social' | 'profile' | 'achievements' | 'challenges';

const BRIEFING_KEY = 'strivn_last_briefing';

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>('goals');
  const [showBriefing, setShowBriefing] = useState(false);
  const { profile, signOut } = useAuth();

  useEffect(() => {
    if (profile) {
      const lastSeen = localStorage.getItem(BRIEFING_KEY);
      const today = getLocalDateString();
      if (lastSeen !== today) {
        setShowBriefing(true);
      }
    }
  }, [profile]);

  const handleDismissBriefing = () => {
    localStorage.setItem(BRIEFING_KEY, getLocalDateString());
    setShowBriefing(false);
  };

  const navItems: { id: View; icon: React.ElementType; label: string }[] = [
    { id: 'goals', icon: Home, label: 'Goals' },
    { id: 'challenges', icon: Calendar, label: 'Challenges' },
    { id: 'character', icon: User, label: 'Character' },
    { id: 'social', icon: Users, label: 'Social' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {showBriefing && (
        <DailyBriefing onDismiss={handleDismissBriefing} />
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Strivn</h1>
              {profile && (
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <Gem className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-900">{profile.gem_balance}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {profile && (
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{profile.username}</p>
                  <p className="text-xs text-slate-500">{profile.streak_count} day streak</p>
                </div>
              )}
              <button
                onClick={signOut}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={[
                    'flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap',
                    isActive
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'goals' && <GoalsView />}
        {currentView === 'challenges' && <ChallengesView />}
        {currentView === 'character' && <CharacterView />}
        {currentView === 'social' && <SocialView />}
        {currentView === 'achievements' && <AchievementsView />}
        {currentView === 'profile' && <ProfileView />}
      </main>
    </div>
  );
}
