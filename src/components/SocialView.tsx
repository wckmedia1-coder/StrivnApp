import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Flame, Trophy } from 'lucide-react';
import { supabase, Post, Comment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function SocialView() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'streak' | 'city' | 'milestone'>('milestone');
  const [loading, setLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [postLikes, setPostLikes] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadFeed();
    }
  }, [user]);

  const loadFeed = async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, streak_count)
      `)
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
      .from('likes')
      .select('post_id')
      .eq('user_id', user?.id);

    if (userLikesData) {
      setUserLikes(new Set(userLikesData.map((l) => l.post_id)));
    }

    setLoading(false);
  };

  const loadCommentsForPost = async (postId: string) => {
    const { data } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (username)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      setPostComments((prev) => ({ ...prev, [postId]: data }));
    }
  };

  const loadLikesForPost = async (postId: string) => {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    setPostLikes((prev) => ({ ...prev, [postId]: count || 0 }));
  };

  const createPost = async () => {
    if (!postContent.trim() || !profile) return;

    const metadata: Record<string, unknown> = {};

    if (postType === 'streak') {
      metadata.streak_count = profile.streak_count;
    } else if (postType === 'city') {
      const { data: city } = await supabase
        .from('cities')
        .select('world_level, total_gems_spent')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (city) {
        metadata.world_level = city.world_level;
        metadata.gems_spent = city.total_gems_spent;
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user?.id,
        post_type: postType,
        content: postContent.trim(),
        metadata,
      })
      .select(`
        *,
        profiles:user_id (username, streak_count)
      `)
      .single();

    if (data && !error) {
      setPosts([data, ...posts]);
      setPostContent('');
      setShowCreatePost(false);
      setPostComments((prev) => ({ ...prev, [data.id]: [] }));
      setPostLikes((prev) => ({ ...prev, [data.id]: 0 }));
    }
  };

  const toggleLike = async (postId: string) => {
    const isLiked = userLikes.has(postId);

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user?.id)
        .eq('post_id', postId);

      setUserLikes((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });

      setPostLikes((prev) => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }));
    } else {
      await supabase
        .from('likes')
        .insert({
          user_id: user?.id,
          post_id: postId,
        });

      setUserLikes((prev) => new Set(prev).add(postId));
      setPostLikes((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  };

  const addComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user?.id,
        content,
      })
      .select(`
        *,
        profiles:user_id (username)
      `)
      .single();

    if (data && !error) {
      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    }
  };

  const getPostIcon = (type: string) => {
    switch (type) {
      case 'streak':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'city':
        return <Trophy className="w-5 h-5 text-blue-500" />;
      default:
        return <Trophy className="w-5 h-5 text-green-500" />;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Social Feed</h2>

        {!showCreatePost && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Share Your Achievement
          </button>
        )}

        {showCreatePost && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['milestone', 'streak', 'city'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPostType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    postType === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Share your progress..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              rows={3}
              maxLength={500}
            />

            <div className="flex gap-2">
              <button
                onClick={createPost}
                disabled={!postContent.trim()}
                className="flex-1 bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
              <button
                onClick={() => {
                  setShowCreatePost(false);
                  setPostContent('');
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {posts.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No posts yet. Be the first to share your achievements!
          </div>
        )}

        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                {post.profiles?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {post.profiles?.username || 'Unknown'}
                  </span>
                  {getPostIcon(post.post_type)}
                </div>
                <p className="text-sm text-slate-500">
                  {new Date(post.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <p className="text-slate-800 mb-4">{post.content}</p>

            {post.metadata && Object.keys(post.metadata).length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600">
                {post.post_type === 'streak' && post.metadata.streak_count && (
                  <span>🔥 {post.metadata.streak_count} day streak!</span>
                )}
                {post.post_type === 'city' && (
                  <span>
                    🏙️ World {post.metadata.world_level} • {post.metadata.gems_spent} gems invested
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 mb-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => toggleLike(post.id)}
                className={`flex items-center gap-2 transition-colors ${
                  userLikes.has(post.id)
                    ? 'text-red-500'
                    : 'text-slate-500 hover:text-red-500'
                }`}
              >
                <Heart
                  className="w-5 h-5"
                  fill={userLikes.has(post.id) ? 'currentColor' : 'none'}
                />
                <span className="text-sm font-medium">{postLikes[post.id] || 0}</span>
              </button>

              <div className="flex items-center gap-2 text-slate-500">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {postComments[post.id]?.length || 0}
                </span>
              </div>
            </div>

            {postComments[post.id] && postComments[post.id].length > 0 && (
              <div className="space-y-3 mb-4">
                {postComments[post.id].map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                      {comment.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-3">
                      <p className="font-medium text-sm text-slate-900">
                        {comment.profiles?.username || 'Unknown'}
                      </p>
                      <p className="text-sm text-slate-700">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={commentInputs[post.id] || ''}
                onChange={(e) =>
                  setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                }
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addComment(post.id);
                  }
                }}
              />
              <button
                onClick={() => addComment(post.id)}
                disabled={!commentInputs[post.id]?.trim()}
                className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
