import { useState, useEffect, useRef } from 'react';
import { UserPlus, UserCheck, UserX, Gem, Flame, Trophy, Camera, Pencil, Check, X } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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
  const { profile, user, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [heatmapData, setHeatmapData] = useState<DayData[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      loadFriends();
      loadPendingRequests();
      loadHeatmap();
      loadAvatar();
    }
  }, [profile]);

  const loadAvatar = async () => {
    if (!user) return;
    const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
    // Check if it actually exists with a cache-busted URL
    const url = `${data.publicUrl}?t=${Date.now()}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) setAvatarUrl(url);
    } catch {
      setAvatarUrl(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    setUploadingAvatar(true);
    const { error } = await supabase.storage.from('avatars').upload(`${user.id}/avatar`, file, {
      upsert: true, contentType: file.type,
    });
    if (!error) await loadAvatar();
    setUploadingAvatar(false);
  };

  const saveUsername = async () => {
    setUsernameError('');
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) { setUsernameError('Must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setUsernameError('Only letters, numbers and underscores'); return; }
    // Check uniqueness
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', trimmed).neq('id', user!.id).maybeSingle();
    if (existing) { setUsernameError('Username already taken'); return; }
    await supabase.from('profiles').update({ username: trimmed }).eq('id', user!.id);
    await refreshProfile();
    setEditingUsername(false);
  };

  const loadHeatmap = async () => {
    const today = new Date();
    const days: DayData[] = [];
    for (let i = 179; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: getLocalDateString(d), completed: 0, total: 0 });
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
        if (day) { day.total += 1; if (row.completed) day.completed += 1; }
      });
    }
    setHeatmapData(days);

    let best = 0, current = 0;
    days.forEach(day => {
      if (day.total > 0 && day.completed === day.total) { current++; best = Math.max(best, current); }
      else if (day.total > 0) current = 0;
    });
    setBestStreak(best);
  };

  // Fixed calendar colors: 0 goals = red, 1-3 = amber, all 5 = green
  const getCalendarColor = (day: DayData, isFuture: boolean): string => {
    if (isFuture) return dark ? '#1a1a2e' : '#f8fafc';
    if (day.total === 0) return dark ? '#2a2a4a' : '#e2e8f0'; // no data
    if (day.completed === 0) return '#ef4444'; // 0 completed = red
    if (day.completed === day.total && day.total >= 5) return '#22c55e'; // all 5 = green
    if (day.completed <= 3) return '#f59e0b'; // 1-3 = amber
    return '#f59e0b'; // 4 = still amber (not quite all 5)
  };

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles:friend_id (id, username, streak_count, gem_balance)')
      .eq('user_id', profile?.id).eq('status', 'accepted');
    if (data) setFriends(data);
    setLoading(false);
  };

  const loadPendingRequests = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles:user_id (id, username, streak_count, gem_balance)')
      .eq('friend_id', profile?.id).eq('status', 'pending');
    if (data) setPendingRequests(data);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('*')
      .ilike('username', `%${searchQuery.trim()}%`).neq('id', profile?.id).limit(10);
    if (data) setSearchResults(data);
  };

  const sendFriendRequest = async (friendId: string) => {
    await supabase.from('friendships').insert({ user_id: profile?.id, friend_id: friendId, status: 'pending' });
    setSearchResults(searchResults.filter(u => u.id !== friendId));
  };

  const acceptFriendRequest = async (userId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('user_id', userId).eq('friend_id', profile?.id);
    await supabase.from('friendships').insert({ user_id: profile?.id, friend_id: userId, status: 'accepted' });
    await loadFriends(); await loadPendingRequests();
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

  const buildCalendarMonths = () => {
    const today = new Date();
    const months = [];
    for (let m = 5; m >= 0; m--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
      const dayCells: (DayData | null)[] = [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          return heatmapData.find(d => d.date === dateStr) || { date: dateStr, completed: 0, total: 0 };
        }),
      ];
      while (dayCells.length % 7 !== 0) dayCells.push(null);
      months.push({ label: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }), dayCells });
    }
    return months;
  };

  const calendarMonths = buildCalendarMonths();
  const todayStr = getLocalDateString(new Date());
  const card = `rounded-xl border p-6 ${dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200 shadow-sm'}`;
  const text = dark ? 'text-white' : 'text-slate-900';
  const subtext = dark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a855f7] ${dark ? 'bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'}`;

  if (loading) return <div className={`text-center py-8 ${subtext}`}>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Profile header */}
      <div className={card}>
        <div className="flex items-center gap-5 mb-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gradient-to-r from-[#a855f7] to-[#ec4899]"
              style={{ borderColor: '#a855f7' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#a855f7] to-[#ec4899] flex items-center justify-center text-white text-2xl font-bold">
                  {profile?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#a855f7] to-[#ec4899] text-white flex items-center justify-center shadow-md hover:opacity-90 transition-opacity">
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Username + edit */}
          <div className="flex-1">
            {editingUsername ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                    className={`${inputCls} text-lg font-bold flex-1`} autoFocus maxLength={20} />
                  <button onClick={saveUsername} className="p-2 text-green-500 hover:text-green-400"><Check className="w-5 h-5" /></button>
                  <button onClick={() => { setEditingUsername(false); setUsernameError(''); }} className={`p-2 ${subtext}`}><X className="w-5 h-5" /></button>
                </div>
                {usernameError && <p className="text-red-400 text-xs">{usernameError}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className={`text-2xl font-bold ${text}`}>{profile?.username}</h2>
                <button onClick={() => { setEditingUsername(true); setNewUsername(profile?.username ?? ''); }}
                  className={`p-1.5 rounded-lg ${dark ? 'text-slate-500 hover:text-white hover:bg-[#2a2a4a]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'} transition-colors`}>
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className={`text-sm mt-1 ${subtext}`}>Member of Strivn</p>
            {uploadingAvatar && <p className="text-xs text-[#a855f7] mt-1">Uploading...</p>}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Flame className="w-5 h-5 text-orange-500" />, value: profile?.streak_count, label: 'Current Streak', bg: dark ? 'bg-orange-500/10' : 'bg-orange-50' },
            { icon: <Flame className="w-5 h-5 text-red-400" />, value: bestStreak, label: 'Best Streak', bg: dark ? 'bg-red-500/10' : 'bg-red-50' },
            { icon: <Gem className="w-5 h-5 text-blue-400" />, value: profile?.gem_balance, label: 'Gem Balance', bg: dark ? 'bg-blue-500/10' : 'bg-blue-50' },
            { icon: <Trophy className="w-5 h-5 text-[#a855f7]" />, value: profile?.total_gems_earned, label: 'Total Earned', bg: dark ? 'bg-purple-500/10' : 'bg-purple-50' },
          ].map((s, i) => (
            <div key={i} className={`flex flex-col items-center p-3 rounded-xl ${s.bg}`}>
              {s.icon}
              <p className={`text-xl font-bold mt-1 ${text}`}>{s.value}</p>
              <p className={`text-xs text-center ${subtext}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar heatmap */}
      <div className={card}>
        <h2 className={`text-xl font-bold mb-1 ${text}`}>Activity</h2>
        <p className={`text-sm mb-6 ${subtext}`}>Your goal completions over the last 6 months</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {calendarMonths.map((month, mi) => (
            <div key={mi}>
              <h3 className={`text-sm font-semibold mb-2 ${text}`}>{month.label}</h3>
              <div className="grid grid-cols-7 mb-1 gap-0.5">
                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                  <div key={d} className={`text-center font-medium ${subtext}`} style={{ fontSize: '10px' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {month.dayCells.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />;
                  const dateNum = parseInt(day.date.split('-')[2]);
                  const isToday = day.date === todayStr;
                  const isFuture = day.date > todayStr;
                  const bgColor = getCalendarColor(day, isFuture);
                  const lightText = day.completed > 0 && !isFuture;

                  return (
                    <div key={di}
                      title={isFuture ? '' : `${day.date}: ${day.completed}/${day.total} goals`}
                      className={`aspect-square flex items-center justify-center rounded-sm cursor-pointer transition-transform hover:scale-110 ${isToday ? 'ring-2 ring-[#a855f7] ring-offset-1' : ''}`}
                      style={{ backgroundColor: bgColor }}>
                      <span style={{ fontSize: '9px', color: lightText ? '#fff' : dark ? '#4a4a6a' : '#94a3b8', fontWeight: isToday ? 'bold' : 'normal' }}>
                        {dateNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 flex-wrap">
          {[
            { color: dark ? '#2a2a4a' : '#e2e8f0', label: 'No goals' },
            { color: '#ef4444', label: '0 done' },
            { color: '#f59e0b', label: '1–3 done' },
            { color: '#22c55e', label: 'All 5 ✅' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className={`text-xs ${subtext}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Find Friends */}
      <div className={card}>
        <h2 className={`text-xl font-bold mb-4 ${text}`}>Find Friends</h2>
        <div className="flex gap-2 mb-4">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
            placeholder="Search by username..."
            className={`flex-1 ${inputCls}`} />
          <button onClick={searchUsers}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white font-medium text-sm">
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 mb-4">
            {searchResults.map(u => (
              <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-50'}`}>
                <div>
                  <p className={`font-medium ${text}`}>{u.username}</p>
                  <p className={`text-xs ${subtext}`}>{u.streak_count} day streak • {u.gem_balance} gems</p>
                </div>
                <button onClick={() => sendFriendRequest(u.id)} className="p-2 text-[#a855f7] hover:bg-[#a855f7]/10 rounded-lg transition-colors">
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="mb-4">
            <h3 className={`text-sm font-semibold mb-2 ${text}`}>Pending Requests</h3>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div key={req.user_id} className={`flex items-center justify-between p-3 rounded-lg border ${dark ? 'bg-[#0d0d1a] border-[#2a2a4a]' : 'bg-blue-50 border-blue-200'}`}>
                  <div>
                    <p className={`font-medium ${text}`}>{req.profiles?.username || 'Unknown'}</p>
                    <p className={`text-xs ${subtext}`}>Wants to be friends</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptFriendRequest(req.user_id)} className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><UserCheck className="w-5 h-5" /></button>
                    <button onClick={() => rejectFriendRequest(req.user_id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><UserX className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Friends list */}
      <div className={card}>
        <h2 className={`text-xl font-bold mb-4 ${text}`}>Friends ({friends.length})</h2>
        {friends.length === 0 && <p className={`text-center py-8 ${subtext}`}>No friends yet. Search for users to connect!</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {friends.map(f => (
            <div key={f.friend_id} className={`flex items-center justify-between p-3 rounded-xl ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a855f7] to-[#ec4899] flex items-center justify-center text-white font-semibold text-sm">
                  {f.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className={`font-medium text-sm ${text}`}>{f.profiles?.username || 'Unknown'}</p>
                  <p className={`text-xs ${subtext}`}>🔥 {f.profiles?.streak_count} • 💎 {f.profiles?.gem_balance}</p>
                </div>
              </div>
              <button onClick={() => removeFriend(f.friend_id)} className={`p-2 ${subtext} hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors`}>
                <UserX className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
