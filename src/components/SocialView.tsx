import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Flame, Trophy, Users, Gem, Building2 } from 'lucide-react';
import { supabase, Post, Comment, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type SocialTab = 'feed' | 'leaderboard';
type LeaderboardTab = 'global' | 'friends';
type LeaderboardEntry = Profile & { building_count?: number };

const medals = ['🥇', '🥈', '🥉'];

export function SocialView() {
  const { user, profile } = useAuth();
  const [socialTab, setSocialTab] = useState<SocialTab>('feed');

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'streak' | 'city' | 'milestone'>('milestone');
  const [loading, setLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [postLikes, setPostLikes] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  // Leaderboard state
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('global');
  const [globalPlayers, setGlobalPlayers] = useState<LeaderboardEntry[]>([]);
  const [friendPlayers, setFriendPlayers] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  useEffect(() => {
    if (user) loadFeed();
  }, [user]);

  useEffect(() => {
    if (socialTab === 'leaderboard' && !leaderboardLoaded) loadLeaderboards();
  }, [socialTab]);

  // ── Feed ──────────────────────────────────────────────
  const loadFeed = async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles:user_id (username, streak_count)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsData) {
      setPosts(postsData);
      for (const post of postsData) {
        await loadCommentsForPost(post.id);
        await loadLikesForPost(post.id);
      }
    }

    const { data: userLikesData } = await supabase
      .from('likes').select('post_id').eq('user_id', user?.id);
    if (userLikesData) setUserLikes(new Set(userLikesData.map(l => l.post_id)));

    setLoading(false);
  };

  const loadCommentsForPost = async (postId: string) => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:user_id (username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) setPostComments(prev => ({ ...prev, [postId]: data }));
  };

  const loadLikesForPost = async (postId: string) => {
    const { count } = await supabase
      .from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    setPostLikes(prev => ({ ...prev, [postId]: count || 0 }));
  };

  const createPost = async () => {
    if (!postContent.trim() || !profile) return;
    const metadata: Record<string, unknown> = {};
    if (postType === 'streak') metadata.streak_count = profile.streak_count;
    else if (postType === 'city') {
      const { data: city } = await supabase.from('cities').select('world_level, total_gems_spent').eq('user_id', user?.id).maybeSingle();
      if (city) { metadata.world_level = city.world_level; metadata.gems_spent = city.total_gems_spent; }
    }
    const { data, error } = await supabase.from('posts')
      .insert({ user_id: user?.id, post_type: postType, content: postContent.trim(), metadata })
      .select('*, profiles:user_id (username, streak_count)').single();
    if (data && !error) {
      setPosts([data, ...posts]);
      setPostContent(''); setShowCreatePost(false);
      setPostComments(prev => ({ ...prev, [data.id]: [] }));
      setPostLikes(prev => ({ ...prev, [data.id]: 0 }));
    }
  };

  const toggleLike = async (postId: string) => {
    const isLiked = userLikes.has(postId);
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user?.id).eq('post_id', postId);
      setUserLikes(prev => { const n = new Set(prev); n.delete(postId); return n; });
      setPostLikes(prev => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }));
    } else {
      await supabase.from('likes').insert({ user_id: user?.id, post_id: postId });
      setUserLikes(prev => new Set(prev).add(postId));
      setPostLikes(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  };

  const addComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    const { data, error } = await supabase.from('comments')
      .insert({ post_id: postId, user_id: user?.id, content })
      .select('*, profiles:user_id (username)').single();
    if (data && !error) {
      setPostComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    }
  };

  const getPostIcon = (type: string) => {
    if (type === 'streak') return <Flame className="w-5 h-5 text-orange-500" />;
    if (type === 'city') return <Trophy className="w-5 h-5 text-blue-500" />;
    return <Trophy className="w-5 h-5 text-green-500" />;
  };

  // ── Leaderboard ───────────────────────────────────────
  const loadLeaderboards = async () => {
    setLeaderboardLoading(true);

    const fetchWithBuildings = async (players: Profile[]): Promise<LeaderboardEntry[]> => {
      return Promise.all(players.map(async p => {
        const { data: city } = await supabase.from('cities').select('id').eq('user_id', p.id).maybeSingle();
        if (!city) return { ...p, building_count: 0 };
        const { count } = await supabase.from('buildings').select('id', { count: 'exact' }).eq('city_id', city.id);
        return { ...p, building_count: count ?? 0 };
      }));
    };

    // Global
    const { data: globalData } = await supabase.from('profiles').select('*').order('streak_count', { ascending: false }).limit(20);
    if (globalData) setGlobalPlayers(await fetchWithBuildings(globalData));

    // Friends
    const { data: friendships } = await supabase.from('friendships').select('friend_id').eq('user_id', user!.id).eq('status', 'accepted');
    if (friendships && friendships.length > 0) {
      const allIds = [user!.id, ...friendships.map(f => f.friend_id)];
      const { data: friendData } = await supabase.from('profiles').select('*').in('id', allIds);
      if (friendData) setFriendPlayers(await fetchWithBuildings(friendData));
    } else if (profile) {
      const { data: city } = await supabase.from('cities').select('id').eq('user_id', user!.id).maybeSingle();
      const { count } = city ? await supabase.from('buildings').select('id', { count: 'exact' }).eq('city_id', city.id) : { count: 0 };
      setFriendPlayers([{ ...profile, building_count: count ?? 0 }]);
    }

    setLeaderboardLoading(false);
    setLeaderboardLoaded(true);
  };

  const leaderboardCategories = [
    { key: 'streak_count' as keyof LeaderboardEntry, label: 'Streak Kings', icon: <Flame className="w-5 h-5 text-orange-500" />, suffix: 'day streak', gradient: 'from-orange-50 to-red-50', border: 'border-orange-200' },
    { key: 'total_gems_earned' as keyof LeaderboardEntry, label: 'Gem Leaders', icon: <Gem className="w-5 h-5 text-blue-500" />, suffix: 'gems earned', gradient: 'from-blue-50 to-indigo-50', border: 'border-blue-200' },
    { key: 'building_count' as keyof LeaderboardEntry, label: 'City Builders', icon: <Building2 className="w-5 h-5 text-green-500" />, suffix: 'buildings', gradient: 'from-green-50 to-teal-50', border: 'border-green-200' },
  ];

  const leaderboardPlayers = leaderboardTab === 'global' ? globalPlayers : friendPlayers;

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Main tab switcher */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setSocialTab('feed')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${socialTab === 'feed' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <MessageCircle className="w-4 h-4" /> Feed
          </button>
          <button
            onClick={() => setSocialTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${socialTab === 'leaderboard' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
        </div>
      </div>

      {/* ── FEED ── */}
      {socialTab === 'feed' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Social Feed</h2>
            {!showCreatePost && (
              <button onClick={() => setShowCreatePost(true)} className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                Share Your Achievement
              </button>
            )}
            {showCreatePost && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['milestone', 'streak', 'city'] as const).map(type => (
                    <button key={type} onClick={() => setPostType(type)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${postType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
                  placeholder="Share your progress..." className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" rows={3} maxLength={500} />
                <div className="flex gap-2">
                  <button onClick={createPost} disabled={!postContent.trim()} className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Post</button>
                  <button onClick={() => { setShowCreatePost(false); setPostContent(''); }} className="px-4 py-2 text-slate-600 hover:text-slate-900">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {posts.length === 0 && <div className="text-center py-8 text-slate-500">No posts yet. Be the first to share your achievements!</div>}
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                    {post.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{post.profiles?.username || 'Unknown'}</span>
                      {getPostIcon(post.post_type)}
                    </div>
                    <p className="text-sm text-slate-500">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="text-slate-800 mb-4">{post.content}</p>
                {post.metadata && Object.keys(post.metadata).length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600">
                    {post.post_type === 'streak' && post.metadata.streak_count && <span>🔥 {post.metadata.streak_count} day streak!</span>}
                    {post.post_type === 'city' && <span>🏙️ World {post.metadata.world_level} • {post.metadata.gems_spent} gems invested</span>}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4 pt-4 border-t border-slate-200">
                  <button onClick={() => toggleLike(post.id)} className={`flex items-center gap-2 transition-colors ${userLikes.has(post.id) ? 'text-red-500' : 'text-slate-500 hover:text-red-500'}`}>
                    <Heart className="w-5 h-5" fill={userLikes.has(post.id) ? 'currentColor' : 'none'} />
                    <span className="text-sm font-medium">{postLikes[post.id] || 0}</span>
                  </button>
                  <div className="flex items-center gap-2 text-slate-500">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{postComments[post.id]?.length || 0}</span>
                  </div>
                </div>
                {postComments[post.id]?.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {postComments[post.id].map(comment => (
                      <div key={comment.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                          {comment.profiles?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-lg p-3">
                          <p className="font-medium text-sm text-slate-900">{comment.profiles?.username || 'Unknown'}</p>
                          <p className="text-sm text-slate-700">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={commentInputs[post.id] || ''} onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="Add a comment..." className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm" maxLength={200}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(post.id); } }} />
                  <button onClick={() => addComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── LEADERBOARD ── */}
      {socialTab === 'leaderboard' && (
        <>
          {leaderboardLoading ? (
            <div className="text-center py-8 text-slate-600">Loading leaderboard...</div>
          ) : (
            <>
              {/* Global / Friends switcher */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex gap-2">
                  <button onClick={() => setLeaderboardTab('global')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${leaderboardTab === 'global' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Trophy className="w-4 h-4" /> Global
                  </button>
                  <button onClick={() => setLeaderboardTab('friends')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${leaderboardTab === 'friends' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Users className="w-4 h-4" /> Friends
                  </button>
                </div>
              </div>

              {leaderboardTab === 'friends' && friendPlayers.length <= 1 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center mb-6">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-700 mb-1">No friends yet!</h3>
                  <p className="text-slate-500 text-sm">Add friends in the Profile tab to compare your progress 💪</p>
                </div>
              )}

              {leaderboardCategories.map(cat => {
                const sorted = [...leaderboardPlayers].sort((a, b) => ((b[cat.key] as number) ?? 0) - ((a[cat.key] as number) ?? 0));
                const top5 = sorted.slice(0, 5);
                const myRank = sorted.findIndex(p => p.id === user?.id);
                const myEntry = sorted[myRank];
                const iInTop5 = top5.some(p => p.id === user?.id);

                return (
                  <div key={String(cat.key)} className={`bg-gradient-to-r ${cat.gradient} rounded-xl border ${cat.border} p-6 mb-4`}>
                    <div className="flex items-center gap-2 mb-4">
                      {cat.icon}
                      <h3 className="text-lg font-bold text-slate-900">{cat.label}</h3>
                    </div>
                    <div className="space-y-2">
                      {top5.map((player, index) => {
                        const isMe = player.id === user?.id;
                        const value = (player[cat.key] as number) ?? 0;
                        return (
                          <div key={player.id} className={`flex items-center gap-3 p-3 rounded-lg ${isMe ? 'bg-white shadow-sm border-2 border-slate-900' : 'bg-white/70'}`}>
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
                      {!iInTop5 && myEntry && (
                        <>
                          <div className="text-center text-slate-400 text-xs py-1">· · ·</div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-white shadow-sm border-2 border-slate-900">
                            <div className="w-8 text-center"><span className="text-slate-500 font-bold text-sm">#{myRank + 1}</span></div>
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                              {myEntry.username?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate">{myEntry.username} <span className="text-xs text-slate-500">(you)</span></p>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
