import { supabase } from './supabase';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  required_value: number;
};

export type UserAchievement = {
  achievement_id: string;
  earned_at: string;
};

export async function checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
  const cityRes = await supabase
    .from('cities')
    .select('id, world_level')
    .eq('user_id', userId)
    .maybeSingle();

  const city = cityRes.data;

  const [profileRes, buildingsRes, userAchievementsRes, allAchievementsRes] =
    await Promise.all([
      supabase.from('profiles').select('streak_count, total_gems_earned, total_goals_completed').eq('id', userId).maybeSingle(),
      supabase.from('buildings').select('id', { count: 'exact' }).eq('city_id', city?.id ?? ''),
      supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
      supabase.from('achievements').select('*'),
    ]);

  const profile = profileRes.data;
  const buildingCount = buildingsRes.count ?? 0;
  const earned = new Set((userAchievementsRes.data ?? []).map((a) => a.achievement_id));
  const allAchievements: Achievement[] = allAchievementsRes.data ?? [];

  if (!profile) return [];

  const newlyEarned: Achievement[] = [];

  for (const achievement of allAchievements) {
    if (earned.has(achievement.id)) continue;

    let qualifies = false;

    if (achievement.category === 'streak') {
      qualifies = (profile.streak_count ?? 0) >= achievement.required_value;
    } else if (achievement.category === 'gems') {
      qualifies = (profile.total_gems_earned ?? 0) >= achievement.required_value;
    } else if (achievement.category === 'city') {
      if (achievement.id.startsWith('world_')) {
        qualifies = (city?.world_level ?? 1) >= achievement.required_value;
      } else {
        qualifies = buildingCount >= achievement.required_value;
      }
    } else if (achievement.category === 'goals') {
      qualifies = (profile.total_goals_completed ?? 0) >= achievement.required_value;
    }

    if (qualifies) {
      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement_id: achievement.id,
      });
      if (!error) newlyEarned.push(achievement);
    }
  }

  return newlyEarned;
}

export async function getUserAchievements(userId: string): Promise<(Achievement & { earned_at: string })[]> {
  const { data } = await supabase
    .from('user_achievements')
    .select(`achievement_id, earned_at, achievements (*)`)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (!data) return [];

  return data.map((row: any) => ({
    ...row.achievements,
    earned_at: row.earned_at,
  }));
}

export async function getAllAchievements(): Promise<Achievement[]> {
  const { data } = await supabase.from('achievements').select('*');
  return data ?? [];
}
