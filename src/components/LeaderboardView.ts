import { useState, useEffect } from 'react';
import { Flame, Gem, Building2, Trophy, Users } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type LeaderboardEntry = Profile & { building_count?: number };
type Tab = 'global' | 'friends';

const medals = ['🥇', '🥈', '🥉'];

export function LeaderboardView() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('global');
  const [globalPlayers, setGlobalPlayers] = useState<LeaderboardEntry[]>([]);
  const [friendPlayers, setFriendPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadLeaderboards();
  }, [user]);

  const loadLeaderboards = async () => {
    // Load global top players
    const { data: globalData } = await supabase
      .from('profiles')
      .select('*')
      .order('streak_count', { ascending: false })
      .limit(20);

    if (globalData) {
      // Fetch building counts for each player
      const withBuildings = await Promise.all(
        globalData.map(async (p) => {
          const { data: city } = await supabase
            .from('cities')
            .select('id')
            .eq('user_id', p.id)
            .maybeSingle();
          if (!city) return { ...p, building_count: 0 };
          const { count } = await supabase
            .from('buildings')
            .select('id', { count: 'exact' })
            .eq('city_id', city.id);
          return { ...p, building_count: count ?? 0 };
        })
      );
      setGlobalPlayers(withBuildings);
    }

    // Load friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user!.id)
      .eq('status', 'accepted');

    if (friendships && friendships.length > 0) {
      const friendIds = friendships.map(f => f.friend_id);
      const allIds = [user!.id, ...friendIds];

      const { data: friendData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allIds);

      if (friendData) {
        const withBuildings = await Promise.all(
          friendData.map(async (p) => {
            const { data: city } = await supabase
              .from('cities')
              .select('id')
              .eq('user_id', p.id)
              .maybeSingle();
            if (!city) return { ...p, building_count: 0 };
            const { count } = await supabase
              .from('buildings')
              .select('id', { count: 'exact' })
              .eq('city_id', city.id);
            return { ...p, building_count: count ?? 0 };
          })
        );
        setFriendPlayers(withBuildings);
      }
    } else {
      // Just show current user in friends tab
      if (profile) {
        const { data: city } = await supabase.from('cities').select('id').eq('user_id', user!.id).maybeSingle();
        const { count } = city ? await supabase.from('buildings').select('id', { count: 'exact' }).eq('city_id', city.id) : { count: 0 };
        setFriendPlayers([{ ...profile, building_count: count ?? 0 }]);
      }
    }

    setLoading(false);
  };

  const players = tab === 'global' ? globalPlayers : friendPlayers;

  const categories = [
    {
      key: 'streak_count' as keyof LeaderboardEntry,
      label: 'Streak Kings',
      icon: <Flame className="w-5 h-5 text-orange-500" />,
      suffix: 'day streak',
      color: 'from-orange-50 to-red-50',
      border: 'border-orange-200',
    },
    {
      key: 'total_gems_earned' as keyof LeaderboardEntry,
      label: 'Gem Leaders',
      icon: <Gem className="w-5 h-5 text-blue-500" />,
      suffix: 'gems earned',
      color: 'from-blue-50 to-indigo-50',
      border: 'border-blue-200',
    },
    {
      key: 'building_count' as keyof LeaderboardEntry,
      label: 'City Builders',
      icon: <Building2 className="w-5 h-5 text-green-500" />,
      suffix: 'buildings',
      color: 'from-green-50 to-teal-50',
      border: 'border-green-200',
    },
  ];

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-7 h-7 text-yellow-500" />
          <h2 className="text-2xl font-bold text-slate-900">Leaderboard</h2>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('global')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              tab === 'global' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Global
          </button>
          <button
            onClick={() => setTab('friends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              tab === 'friends' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Friends
          </button>
        </div>
      </div>

      {tab === 'friends' && friendPlayers.length <= 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center mb-6">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No friends yet!</h3>
          <p className="text-slate-500 text-sm">Add friends in the Social tab to compare your progress 💪</p>
        </div>
      )}

      {/* 3 leaderboard rows */}
      {categories.map(cat => {
        const sorted = [...players].sort((a, b) => ((b[cat.key] as number) ?? 0) - ((a[cat.key] as number) ?? 0));
        const top5 = sorted.slice(0, 5);
        const myRank = sorted.findIndex(p => p.id === user?.id);
        const myEntry = sorted[myRank];
        const iInTop5 = top5.some(p => p.id === user?.id);

        return (
          <div key={cat.key} className={`bg-gradient-to-r ${cat.color} rounded-xl border ${cat.border} p-6 mb-4`}>
            <div className="flex items-center gap-2 mb-4">
              {cat.icon}
              <h3 className="text-lg font-bold text-slate-900">{cat.label}</h3>
            </div>

            <div className="space-y-2">
              {top5.map((player, index) => {
                const isMe = player.id === user?.id;
                const value = (player[cat.key] as number) ?? 0;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isMe ? 'bg-white shadow-sm border-2 border-slate-900' : 'bg-white/70'
                    }`}
                  >
                    <div className="w-8 text-center text-lg">
                      {index < 3 ? medals[index] : <span className="text-slate-500 font-bold text-sm">#{index + 1}</span>}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                      {player.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isMe ? 'text-slate-900' : 'text-slate-700'}`}>
                        {player.username} {isMe && <span className="text-xs text-slate-500">(you)</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900 text-sm">{value}</p>
                      <p className="text-xs text-slate-500">{cat.suffix}</p>
                    </div>
                  </div>
                );
              })}

              {/* Show my rank if not in top 5 */}
              {!iInTop5 && myEntry && (
                <>
                  <div className="text-center text-slate-400 text-xs py-1">· · ·</div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white shadow-sm border-2 border-slate-900">
                    <div className="w-8 text-center">
                      <span className="text-slate-500 font-bold text-sm">#{myRank + 1}</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                      {myEntry.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {myEntry.username} <span className="text-xs text-slate-500">(you)</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900 text-sm">{(myEntry[cat.key] as number) ?? 0}</p>
                      <p className="text-xs text-slate-500">{cat.suffix}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
