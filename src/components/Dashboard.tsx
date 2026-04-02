import { useState } from 'react';
import { Home, User, Users, LogOut, Calendar, Moon, Sun, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { GoalsView } from './GoalsView';
import { CharacterView } from './CharacterView';
import { SocialView } from './SocialView';
import { ProfileView } from './ProfileView';
import { AchievementsView } from './AchievementsView';
import { ChallengesView } from './ChallengesView';
import { getLevelFromXp } from '../lib/gameLogic';

type View = 'goals' | 'character' | 'social' | 'profile' | 'achievements' | 'challenges';

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>('goals');
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const totalXp = (profile as any)?.total_xp ?? 0;
  const { level, xpInLevel, xpNeeded } = getLevelFromXp(totalXp);
  const progressPct = Math.round((xpInLevel / xpNeeded) * 100);

  const navItems: { id: View; icon: React.ElementType; label: string }[] = [
    { id: 'goals',        icon: Home,     label: 'Goals' },
    { id: 'challenges',   icon: Calendar, label: 'Challenges' },
    { id: 'character',    icon: User,     label: 'Character' },
    { id: 'social',       icon: Users,    label: 'Social' },
    { id: 'achievements', icon: Trophy,   label: 'Achievements' },
    { id: 'profile',      icon: User,     label: 'Profile' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      dark ? 'bg-[#0d0d1a]' : 'bg-gradient-to-br from-[#f3e8ff] via-[#fce4ec] to-[#e8eaf6]'
    }`}>

      {/* Header */}
      <header className={`sticky top-0 z-10 border-b backdrop-blur-md transition-colors duration-300 ${
        dark ? 'bg-[#13132a]/90 border-[#2a2a4a]' : 'bg-white/70 border-pink-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">

            {/* Left: logo + level bar */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
                Strivn
              </span>
              {profile && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  dark ? 'bg-[#1e1e3a] border-[#3a3a5c]' : 'bg-white/80 border-pink-200'
                }`}>
                  <span className={`text-xs font-bold ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                    Lv {level}
                  </span>
                  <div className={`w-20 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-200'}`}>
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-[#a855f7] to-[#ec4899] transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {xpInLevel}/{xpNeeded} XP
                  </span>
                </div>
              )}
            </div>

            {/* Right: username, theme toggle, sign out */}
            <div className="flex items-center gap-3">
              {profile && (
                <div className="text-right hidden sm:block">
                  <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>{profile.username}</p>
                  <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>🔥 {profile.streak_count} day streak</p>
                </div>
              )}
              <button onClick={toggleTheme}
                className={`p-2 rounded-full border transition-all ${
                  dark ? 'bg-[#1e1e3a] border-[#3a3a5c] text-yellow-300 hover:bg-[#2a2a4a]' : 'bg-white/80 border-pink-200 text-slate-600 hover:bg-pink-50'
                }`} title={dark ? 'Light mode' : 'Dark mode'}>
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={signOut}
                className={`p-2 rounded-full border transition-all ${
                  dark ? 'bg-[#1e1e3a] border-[#3a3a5c] text-slate-400 hover:text-white' : 'bg-white/80 border-pink-200 text-slate-500 hover:text-slate-800'
                }`} title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className={`border-b sticky top-[57px] z-10 backdrop-blur-md transition-colors duration-300 ${
        dark ? 'bg-[#13132a]/90 border-[#2a2a4a]' : 'bg-white/60 border-pink-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            {navItems.map(({ id, icon: Icon, label }) => {
              const isActive = currentView === id;
              return (
                <button key={id} onClick={() => setCurrentView(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? dark ? 'border-[#a855f7] text-[#c084fc]' : 'border-[#ec4899] text-[#ec4899]'
                      : dark ? 'border-transparent text-slate-400 hover:text-white hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-[#a855f7] hover:bg-pink-50/50'
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'goals'        && <GoalsView />}
        {currentView === 'challenges'   && <ChallengesView />}
        {currentView === 'character'    && <CharacterView />}
        {currentView === 'social'       && <SocialView />}
        {currentView === 'achievements' && <AchievementsView />}
        {currentView === 'profile'      && <ProfileView />}
      </main>
    </div>
  );
}
