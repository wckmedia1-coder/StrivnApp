import { supabase } from './supabase';

export type DailyChallenge = {
  id: string;
  title: string;
  description: string;
  gem_reward: number;
  challenge_date: string;
  challenge_type: string;
  required_value: number;
};

export type UserChallengeCompletion = {
  id: string;
  user_id: string;
  challenge_id: string;
  completed_at: string;
  gems_earned: number;
};

export async function getTodaysChallenges(): Promise<DailyChallenge[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', today)
    .order('gem_reward', { ascending: false });

  return data ?? [];
}

export async function getUserCompletionsToday(userId: string): Promise<UserChallengeCompletion[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_challenge_completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`);

  return data ?? [];
}

export async function checkChallengeEligibility(
  userId: string,
  challenge: DailyChallenge
): Promise<boolean> {
  if (challenge.challenge_type === 'complete_all_goals') {
    const today = new Date().toISOString().split('T')[0];
    const { data: instances } = await supabase
      .from('daily_goal_instances')
      .select('completed')
      .eq('user_id', userId)
      .eq('date', today);

    if (!instances || instances.length === 0) return false;
    return instances.every((i) => i.completed);
  }

  if (challenge.challenge_type === 'streak') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_count')
      .eq('id', userId)
      .maybeSingle();

    return (profile?.streak_count ?? 0) >= challenge.required_value;
  }

  if (challenge.challenge_type === 'place_building') {
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!city) return false;

    const today = new Date().toISOString().split('T')[0];
    const { data: buildings } = await supabase
      .from('buildings')
      .select('id')
      .eq('city_id', city.id)
      .gte('created_at', `${today}T00:00:00`);

    return (buildings?.length ?? 0) >= challenge.required_value;
  }

  return false;
}

export async function completeChallenge(
  userId: string,
  challenge: DailyChallenge
): Promise<{ success: boolean; message: string }> {
  const isEligible = await checkChallengeEligibility(userId, challenge);

  if (!isEligible) {
    const messages: Record<string, string> = {
      complete_all_goals: 'Complete all your goals today first!',
      streak: `You need at least a ${challenge.required_value} day streak!`,
      place_building: 'Place a building in your city today first!',
    };
    return {
      success: false,
      message: messages[challenge.challenge_type] ?? 'Requirements not met yet!',
    };
  }

  const { error } = await supabase
    .from('user_challenge_completions')
    .insert({
      user_id: userId,
      challenge_id: challenge.id,
      gems_earned: challenge.gem_reward,
    });

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'Already completed!' };
    }
    return { success: false, message: 'Something went wrong.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gem_balance, total_gems_earned')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    await supabase
      .from('profiles')
      .update({
        gem_balance: profile.gem_balance + challenge.gem_reward,
        total_gems_earned: profile.total_gems_earned + challenge.gem_reward,
      })
      .eq('id', userId);
  }

  return { success: true, message: `+${challenge.gem_reward} gems earned!` };
}
