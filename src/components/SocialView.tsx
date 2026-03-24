import { useState, useEffect } from 'react';
import { Heart, MessageCircle, ChevronDown, ChevronUp, Send, Flame, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; streak_count: number; gem_balance: number };
  likes?: Like[];
  replies?: Reply[];
  like_count?: number;
  reply_count?: number;
  user_liked?: boolean;
};

type Like = {
  id: string;
  post_id: string;
  user_id: string;
};

type Reply = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string };
};

export function SocialView() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);

  // Per-post reply state
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [postReplies, setPostReplies] = useState<Record<string, Reply[]>>({});
  const [likingPost, setLikingPost] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    // Load posts with profiles
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles:user_id (username, streak_count, gem_balance)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!postsData) { setLoading(false); return; }

    // Load likes and reply counts in parallel
    const postIds = postsData.map(p => p.id);

    const [{ data: likesData }, { data: repliesCountData }] = await Promise.all([
      supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
      supabase.from('post_replies').select('post_id').in('post_id', postIds),
    ]);

    const enriched = postsData.map(p => {
      const likes = (likesData ?? []).filter(l => l.post_id === p.id);
      const replyCount = (repliesCountData ?? []).filter(r => r.post_id === p.id).length;
      return {
        ...p,
        like_count: likes.length,
        reply_count: replyCount,
        user_liked: likes.some(l => l.user_id === user!.id),
      };
    });

    setPosts(enriched as Post[]);
    setLoading(false);
  };

  const createPost = async () => {
    if (!newPost.trim() || posting) return;
    setPosting(true);
    await supabase.from('posts').insert({
      user_id: user!.id,
      content: newPost.trim(),
    });
    setNewPost('');
    await load();
    setPosting(false);
  };

  const toggleLike = async (post: Post) => {
    if (likingPost[post.id]) return;
    setLikingPost(p => ({ ...p, [post.id]: true }));

    if (post.user_liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user!.id);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user!.id });
    }

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      user_liked: !p.user_liked,
      like_count: (p.like_count ?? 0) + (p.user_liked ? -1 : 1),
    } : p));

    setLikingPost(p => ({ ...p, [post.id]: false }));
  };

  const toggleReplies = async (postId: string) => {
    const nowOpen = !openReplies[postId];
    setOpenReplies(p => ({ ...p, [postId]: nowOpen }));
    if (nowOpen && !postReplies[postId]) {
      const { data } = await supabase
        .from('post_replies')
        .select('*, profiles:user_id (username)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      setPostReplies(p => ({ ...p, [postId]: (data ?? []) as Reply[] }));
    }
  };

  const submitReply = async (postId: string) => {
    const content = replyInputs[postId]?.trim();
    if (!content || submittingReply[postId]) return;
    setSubmittingReply(p => ({ ...p, [postId]: true }));

    const { data } = await supabase.from('post_replies').insert({
      post_id: postId,
      user_id: user!.id,
      content,
    }).select('*, profiles:user_id (username)').single();

    if (data) {
      setPostReplies(p => ({ ...p, [postId]: [...(p[postId] ?? []), data as Reply] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reply_count: (p.reply_count ?? 0) + 1 } : p));
    }
    setReplyInputs(p => ({ ...p, [postId]: '' }));
    setSubmittingReply(p => ({ ...p, [postId]: false }));
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const card = `rounded-2xl border transition-all ${dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200/80 shadow-sm'}`;
  const text = dark ? 'text-white' : 'text-slate-800';
  const subtext = dark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${dark ? 'bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`;
  const replyInputCls = `flex-1 px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-[#0d0d1a] border-[#2a2a4a] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Compose */}
      <div className={`${card} p-5`}>
        <h2 className={`text-lg font-bold mb-3 ${text}`}>Community</h2>
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createPost(); }}
          placeholder="Share a win, a reflection, or some encouragement…"
          rows={3}
          maxLength={500}
          className={inputCls}
        />
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs ${subtext}`}>{newPost.length}/500</span>
          <button
            onClick={createPost}
            disabled={!newPost.trim() || posting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-400 text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading && (
        <div className={`text-center py-10 ${subtext}`}>Loading posts…</div>
      )}

      {!loading && posts.length === 0 && (
        <div className={`text-center py-10 ${subtext}`}>
          <p className="text-3xl mb-2">🌿</p>
          <p className="text-sm">No posts yet — be the first to share something!</p>
        </div>
      )}

      {posts.map(post => (
        <div key={post.id} className={card}>
          {/* Post header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {post.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${text}`}>{post.profiles?.username ?? 'Unknown'}</p>
                  <div className={`flex items-center gap-2 text-xs ${subtext}`}>
                    <span className="flex items-center gap-0.5 text-orange-400">
                      <Flame className="w-3 h-3" />{post.profiles?.streak_count ?? 0}
                    </span>
                    <span>·</span>
                    <span>{formatTime(post.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className={`mt-3 text-sm leading-relaxed ${text}`}>{post.content}</p>
          </div>

          {/* Action bar */}
          <div className={`flex items-center gap-1 px-4 pb-3 pt-1 border-t ${dark ? 'border-[#2a2a4a]' : 'border-slate-100'}`}>
            {/* Like button */}
            <button
              onClick={() => toggleLike(post)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                post.user_liked
                  ? dark ? 'text-pink-400 bg-pink-500/10' : 'text-pink-500 bg-pink-50'
                  : dark ? 'text-slate-400 hover:text-pink-400 hover:bg-pink-500/10' : 'text-slate-400 hover:text-pink-500 hover:bg-pink-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`} />
              <span>{post.like_count ?? 0}</span>
            </button>

            {/* Replies toggle */}
            <button
              onClick={() => toggleReplies(post.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                openReplies[post.id]
                  ? dark ? 'text-indigo-400 bg-indigo-500/10' : 'text-indigo-600 bg-indigo-50'
                  : dark ? 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{post.reply_count ?? 0}</span>
              {openReplies[post.id]
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
            </button>
          </div>

          {/* Replies dropdown */}
          {openReplies[post.id] && (
            <div className={`px-4 pb-4 space-y-3 border-t ${dark ? 'border-[#2a2a4a]' : 'border-slate-100'}`}>
              {/* Existing replies */}
              <div className="space-y-2 pt-3">
                {(postReplies[post.id] ?? []).length === 0 && (
                  <p className={`text-xs text-center py-2 ${subtext}`}>No replies yet — say something kind 🌱</p>
                )}
                {(postReplies[post.id] ?? []).map(reply => (
                  <div key={reply.id} className={`flex gap-2.5`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: '9px' }}>
                      {reply.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className={`flex-1 rounded-xl px-3 py-2 text-sm ${dark ? 'bg-[#13132a]' : 'bg-slate-50'}`}>
                      <span className={`font-semibold ${text}`}>{reply.profiles?.username ?? 'Unknown'} </span>
                      <span className={subtext}>{reply.content}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="flex gap-2 items-center pt-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-400 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: '9px' }}>
                  {profile?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <input
                  value={replyInputs[post.id] ?? ''}
                  onChange={e => setReplyInputs(p => ({ ...p, [post.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && submitReply(post.id)}
                  placeholder="Write a reply…"
                  maxLength={300}
                  className={replyInputCls}
                />
                <button
                  onClick={() => submitReply(post.id)}
                  disabled={!replyInputs[post.id]?.trim() || submittingReply[post.id]}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500 text-white disabled:opacity-40 transition-opacity flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
