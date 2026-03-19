import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, UserX, Gem, Flame, Trophy } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Friendship = {
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  profiles?: Profile;
};

type DayData = {
  date: string;
  completed: number;
  total: number;
};

function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ProfileView() {
  const { profile, user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [cityStats, setCityStats] = useState<{ world_level: number; total_gems_spent: number } | null>(null);
  const [heatmapData, setHeatmapData] = useState<DayData[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadFriends();
      loadPendingRequests();
      loadCityStats();
      loadHeatmap();
    }
  }, [profile]);

const loadHeatmap = async () => {
  const today = new Date();
  const days: DayData[] = [];

  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: getLocalDateString(d),
      completed: 0,
      total: 0,
    });
  }

  const startDate = days[0].date;
  const { data } = await supabase
    .from('daily_goal_instances')
    .select('date, completed')
    .eq('user_id', user?.id)
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (data) {
    data.forEach(row => {
      const day = days.find(d => d.date === row.date);
      if (day) {
        day.total += 1;
        if (row.completed) day.completed += 1;
      }
    });
  }

  setHeatmapData(days);

  let best = 0;
  let current = 0;
  days.forEach(day => {
    if (day.total > 0 && day.completed === day.total) {
      current++;
      best = Math.max(best, current);
    } else if (day.total > 0) {
      current = 0;
    }
  });
  setBestStreak(best);
};

  const getHeatmapColor = (day: DayData) => {
    if (day.total === 0) return '#e2e8f0';
    const ratio = day.completed / day.total;
    if (ratio === 0) return '#fecaca';
    if (ratio < 0.5) return '#86efac';
    if (ratio < 1) return '#22c55e';
    return '#15803d';
  };

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles:friend_id (id, username, streak_count, gem_balance)')
      .eq('user_id', profile?.id)
      .eq('status', 'accepted');
    if (data) setFriends(data);
    setLoading(false);
  };

  const loadPendingRequests = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles:user_id (id, username, streak_count, gem_balance)')
      .eq('friend_id', profile?.id)
      .eq('status', 'pending');
    if (data) setPendingRequests(data);
  };

  const loadCityStats = async () => {
    const { data } = await supabase
      .from('cities')
      .select('world_level, total_gems_spent')
      .eq('user_id', profile?.id)
      .maybeSingle();
    if (data) setCityStats(data);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', profile?.id)
      .limit(10);
    if (data) setSearchResults(data);
  };

  const sendFriendRequest = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: profile?.id, friend_id: friendId, status: 'pending' });
    if (!error) setSearchResults(searchResults.filter(u => u.id !== friendId));
  };

  const acceptFriendRequest = async (userId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('user_id', userId).eq('friend_id', profile?.id);
    await supabase.from('friendships').insert({ user_id: profile?.id, friend_id: userId, status: 'accepted' });
    await loadFriends();
    await loadPendingRequests();
  };

  const rejectFriendRequest = async (userId: string) => {
    await supabase.from('friendships').delete().eq('user_id', userId).eq('friend_id', profile?.id);
    await loadPendingRequests();
  };

  const removeFriend = async (friendId: string) => {
    await supabase.from('friendships').delete().eq('user_id', profile?.id).eq('friend_id', friendId);
    await supabase.from('friendships').delete().eq('user_id', friendId).eq('friend_id', profile?.id);
    await loadFriends();
  };

  // Build heatmap grid aligned to start on Monday
  const buildGrid = () => {
    if (heatmapData.length === 0) return [];
    const firstDay = new Date(heatmapData[0].date);
    // 0=Sun,1=Mon...6=Sat → convert to Mon=0
    const firstDow = (firstDay.getDay() + 6) % 7;
    // Pad start with empty days so first column starts on Monday
    const padded: (DayData | null)[] = [
      ...Array(firstDow).fill(null),
      ...heatmapData,
    ];
    // Split into weeks
    const weeks: (DayData | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
    return weeks;
  };

  const grid = buildGrid();
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          {profile?.username}'s Profile
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg border border-orange-100">
            <Flame className="w-6 h-6 text-orange-500 mb-1" />
            <p className="text-2xl font-bold text-slate-900">{profile?.streak_count}</p>
            <p className="text-xs text-slate-500 text-center">Current Streak</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-red-50 rounded-lg border border-red-100">
            <Flame className="w-6 h-6 text-red-400 mb-1" />
            <p className="text-2xl font-bold text-slate-900">{bestStreak}</p>
            <p className="text-xs text-slate-500 text-center">Best Streak</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
            <Gem className="w-6 h-6 text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-slate-900">{profile?.gem_balance}</p>
            <p className="text-xs text-slate-500 text-center">Gem Balance</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg border border-green-100">
            <Trophy className="w-6 h-6 text-green-500 mb-1" />
            <p className="text-2xl font-bold text-slate-900">{profile?.total_gems_earned}</p>
            <p className="text-xs text-slate-500 text-center">Total Earned</p>
          </div>
        </div>

        {cityStats && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">City Progress</p>
              <p className="text-xl font-bold text-slate-900">World {cityStats.world_level}</p>
              <p className="text-xs text-slate-500">{cityStats.total_gems_spent} gems invested</p>
            </div>
            <div className="text-4xl">🏙️</div>
          </div>
        )}
      </div>

     {/* Heatmap */}
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
  <h2 className="text-xl font-bold text-slate-900 mb-1">Activity</h2>
  <p className="text-slate-500 text-sm mb-6">Your goal completions this year</p>

  {(() => {
    // Build last 6 months of calendar data
    const today = new Date();
    const months = [];

    for (let m = 5; m >= 0; m--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

      const dayCells: (DayData | null)[] = [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          return heatmapData.find(d => d.date === dateStr) || { date: dateStr, completed: 0, total: 0 };
        }),
      ];

      // Pad to complete last week
      while (dayCells.length % 7 !== 0) dayCells.push(null);

      months.push({
        label: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        dayCells,
      });
    }

    const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {months.map((month, mi) => (
          <div key={mi}>
            {/* Month title */}
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{month.label}</h3>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {dayLabels.map(d => (
                <div key={d} className="text-center text-slate-400 font-medium" style={{ fontSize: '10px' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {month.dayCells.map((day, di) => {
                if (!day) return <div key={di} />;
                const dateNum = parseInt(day.date.split('-')[2]);
                const isToday = day.date === getLocalDateString(new Date());
                const isFuture = day.date > getLocalDateString(new Date());

                return (
                  <div
                    key={di}
                    title={`${day.date}: ${day.completed}/${day.total} goals`}
                    className={`relative flex items-center justify-center rounded-sm cursor-pointer transition-transform hover:scale-110 ${
                      isToday ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: isFuture ? 'transparent' : getHeatmapColor(day),
                      aspectRatio: '1',
                    }}
                  >
                    <span style={{
                      fontSize: '9px',
                      color: day.total > 0 && !isFuture ? '#fff' : '#94a3b8',
                      fontWeight: isToday ? 'bold' : 'normal',
                    }}>
                      {dateNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  })()}

  {/* Legend */}
  <div className="flex items-center gap-2 mt-6 flex-wrap">
    <span className="text-xs text-slate-500">No goals</span>
    <div className="w-4 h-4 rounded-sm bg-slate-200" />
    <div className="w-4 h-4 rounded-sm bg-red-200" />
    <span className="text-xs text-slate-500">Missed</span>
    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#86efac' }} />
    <span className="text-xs text-slate-500">Partial</span>
    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
    <span className="text-xs text-slate-500">Most</span>
    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#15803d' }} />
    <span className="text-xs text-slate-500">All goals ✅</span>
  </div>
</div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-xs text-slate-500">Less</span>
          {['#e2e8f0', '#86efac', '#22c55e', '#15803d'].map(c => (
            <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span className="text-xs text-slate-500">More</span>
          <div className="w-3 h-3 rounded-sm bg-red-200 ml-2" />
          <span className="text-xs text-slate-500">Missed day</span>
          <div className="w-3 h-3 rounded-sm bg-slate-200 ml-2" />
          <span className="text-xs text-slate-500">No goals</span>
        </div>
      </div>

      {/* Find Friends */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Find Friends</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
            placeholder="Search by username..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            onClick={searchUsers}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 mb-4">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">{u.username}</p>
                  <p className="text-xs text-slate-600">{u.streak_count} day streak • {u.gem_balance} gems</p>
                </div>
                <button onClick={() => sendFriendRequest(u.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Pending Requests</h3>
            <div className="space-y-2">
              {pendingRequests.map(request => (
                <div key={request.user_id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-slate-900">{request.profiles?.username || 'Unknown'}</p>
                    <p className="text-xs text-slate-600">Wants to be friends</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptFriendRequest(request.user_id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <UserCheck className="w-5 h-5" />
                    </button>
                    <button onClick={() => rejectFriendRequest(request.user_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <UserX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Friends list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Friends ({friends.length})</h2>
        {friends.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No friends yet. Search for users to connect with!
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {friends.map(friendship => (
            <div key={friendship.friend_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                  {friendship.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{friendship.profiles?.username || 'Unknown'}</p>
                  <p className="text-xs text-slate-600">🔥 {friendship.profiles?.streak_count} • 💎 {friendship.profiles?.gem_balance}</p>
                </div>
              </div>
              <button onClick={() => removeFriend(friendship.friend_id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <UserX className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
