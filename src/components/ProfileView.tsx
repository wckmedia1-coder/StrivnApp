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

export function ProfileView() {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [cityStats, setCityStats] = useState<{ world_level: number; total_gems_spent: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadFriends();
      loadPendingRequests();
      loadCityStats();
    }
  }, [profile]);

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles:friend_id (id, username, streak_count, gem_balance)
      `)
      .eq('user_id', profile?.id)
      .eq('status', 'accepted');

    if (data) {
      setFriends(data);
    }
    setLoading(false);
  };

  const loadPendingRequests = async () => {
    const { data } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles:user_id (id, username, streak_count, gem_balance)
      `)
      .eq('friend_id', profile?.id)
      .eq('status', 'pending');

    if (data) {
      setPendingRequests(data);
    }
  };

  const loadCityStats = async () => {
    const { data } = await supabase
      .from('cities')
      .select('world_level, total_gems_spent')
      .eq('user_id', profile?.id)
      .maybeSingle();

    if (data) {
      setCityStats(data);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', profile?.id)
      .limit(10);

    if (data) {
      setSearchResults(data);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: profile?.id,
        friend_id: friendId,
        status: 'pending',
      });

    if (!error) {
      setSearchResults(searchResults.filter((u) => u.id !== friendId));
    }
  };

  const acceptFriendRequest = async (userId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', userId)
      .eq('friend_id', profile?.id);

    await supabase
      .from('friendships')
      .insert({
        user_id: profile?.id,
        friend_id: userId,
        status: 'accepted',
      });

    await loadFriends();
    await loadPendingRequests();
  };

  const rejectFriendRequest = async (userId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', userId)
      .eq('friend_id', profile?.id);

    await loadPendingRequests();
  };

  const removeFriend = async (friendId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', profile?.id)
      .eq('friend_id', friendId);

    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', profile?.id);

    await loadFriends();
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Stats</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Current Streak</p>
                  <p className="text-xl font-bold text-slate-900">{profile?.streak_count} days</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <Gem className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Gem Balance</p>
                  <p className="text-xl font-bold text-slate-900">{profile?.gem_balance}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Earned</p>
                  <p className="text-xl font-bold text-slate-900">{profile?.total_gems_earned}</p>
                </div>
              </div>
            </div>

            {cityStats && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-sm text-slate-600">City Progress</p>
                  <p className="text-xl font-bold text-slate-900">
                    World {cityStats.world_level}
                  </p>
                  <p className="text-xs text-slate-600">{cityStats.total_gems_spent} gems invested</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Find Friends</h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
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
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{user.username}</p>
                    <p className="text-xs text-slate-600">
                      {user.streak_count} day streak • {user.gem_balance} gems
                    </p>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(user.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
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
                {pendingRequests.map((request) => (
                  <div
                    key={request.user_id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {request.profiles?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-600">Wants to be friends</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptFriendRequest(request.user_id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => rejectFriendRequest(request.user_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Friends ({friends.length})
        </h2>

        {friends.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No friends yet. Search for users to connect with!
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {friends.map((friendship) => (
            <div
              key={friendship.friend_id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                  {friendship.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    {friendship.profiles?.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-600">
                    🔥 {friendship.profiles?.streak_count} • 💎 {friendship.profiles?.gem_balance}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFriend(friendship.friend_id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <UserX className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
