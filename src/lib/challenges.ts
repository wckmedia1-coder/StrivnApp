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

export type WeeklyChallenge = {
  id: string;
  title: string;
  description: string;
  gem_reward: number;
  challenge_type: string;
  required_value: number;
  week_start: string;
};

export type UserChallengeCompletion = {
  id: string;
  user_id: string;
  challenge_id: string;
  completed_at: string;
  gems_earned: number;
};

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Daily ──────────────────────────────────────────────

export async function getTodaysChallenges(): Promise<DailyChallenge[]> {
  const today = getLocalDateString();
  const { data } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', today)
    .order('gem_reward', { ascending: false });
  return data ?? [];
}

export async function getUserCompletionsToday(userId: string): Promise<UserChallengeCompletion[]> {
  const today = getLocalDateString();
  const { data } = await supabase
    .from('user_challenge_completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`);
  return data ?? [];
}

export async function checkDailyChallengeEligibility(
  userId: string,
  challenge: DailyChallenge
): Promise<boolean> {
  const today = getLocalDateString();

  if (challenge.challenge_type === 'complete_all_goals') {
    const { data: instances } = await supabase
      .from('daily_goal_instances')
      .select('completed')
      .eq('user_id', userId)
      .eq('date', today);
    if (!instances || instances.length === 0) return false;
    return instances.every(i => i.completed);
  }

  if (challenge.challenge_type === 'complete_goals_count') {
    const { data: instances } = await supabase
      .from('daily_goal_instances')
      .select('completed')
      .eq('user_id', userId)
      .eq('date', today);
    const completedCount = instances?.filter(i => i.completed).length ?? 0;
    return completedCount >= challenge.required_value;
  }

  if (challenge.challenge_type === 'place_building') {
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!city) return false;
    const { data: buildings } = await supabase
      .from('buildings')
      .select('id')
      .eq('city_id', city.id)
      .gte('created_at', `${today}T00:00:00`);
    return (buildings?.length ?? 0) >= challenge.required_value;
  }

  return false;
}

export async function completeDaily(
  userId: string,
  challenge: DailyChallenge
): Promise<{ success: boolean; message: string }> {
  const isEligible = await checkDailyChallengeEligibility(userId, challenge);

  if (!isEligible) {
    const messages: Record<string, string> = {
      complete_all_goals: 'Complete all your goals today first!',
      complete_goals_count: `Complete ${challenge.required_value} goals today first!`,
      place_building: `Place ${challenge.required_value} building(s) in your city today first!`,
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
    if (error.code === '23505') return { success: false, message: 'Already completed today!' };
    return { success: false, message: 'Something went wrong.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gem_balance, total_gems_earned')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    await supabase.from('profiles').update({
      gem_balance: profile.gem_balance + challenge.gem_reward,
      total_gems_earned: profile.total_gems_earned + challenge.gem_reward,
    }).eq('id', userId);
  }

  return { success: true, message: `+${challenge.gem_reward} gems earned!` };
}

// ── Weekly ─────────────────────────────────────────────

export async function getWeeklyChallenges(): Promise<WeeklyChallenge[]> {
  const weekStart = getWeekStart();
  const { data } = await supabase
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', weekStart)
    .order('gem_reward', { ascending: false });
  return data ?? [];
}

export async function getUserWeeklyCompletions(userId: string): Promise<UserChallengeCompletion[]> {
  const weekStart = getWeekStart();
  const { data } = await supabase
    .from('user_weekly_challenge_completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', `${weekStart}T00:00:00`);
  return data ?? [];
}

export async function checkWeeklyChallengeEligibility(
  userId: string,
  challenge: WeeklyChallenge
): Promise<boolean> {
  const weekStart = getWeekStart();

  if (challenge.challenge_type === 'goals_days') {
    const { data: instances } = await supabase
      .from('daily_goal_instances')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', weekStart);

    if (!instances) return false;

    const byDate: Record<string, { total: number; completed: number }> = {};
    instances.forEach(row => {
      if (!byDate[row.date]) byDate[row.date] = { total: 0, completed: 0 };
      byDate[row.date].total++;
      if (row.completed) byDate[row.date].completed++;
    });

    const fullDays = Object.values(byDate).filter(
      d => d.total > 0 && d.completed === d.total
    ).length;
    return fullDays >= challenge.required_value;
  }

  if (challenge.challenge_type === 'gems_earned') {
    const { data: instances } = await supabase
      .from('daily_goal_instances')
      .select('gems_earned')
      .eq('user_id', userId)
      .gte('date', weekStart);

    const total = instances?.reduce((sum, i) => sum + (i.gems_earned ?? 0), 0) ?? 0;
    return total >= challenge.required_value;
  }

  if (challenge.challenge_type === 'place_buildings') {
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!city) return false;

    const { data: buildings } = await supabase
      .from('buildings')
      .select('id')
      .eq('city_id', city.id)
      .gte('created_at', `${weekStart}T00:00:00`);

    return (buildings?.length ?? 0) >= challenge.required_value;
  }

  if (challenge.challenge_type === 'streak') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_count')
      .eq('id', userId)
      .maybeSingle();
    return (profile?.streak_count ?? 0) >= challenge.required_value;
  }

  return false;
}

export async function completeWeekly(
  userId: string,
  challenge: WeeklyChallenge
): Promise<{ success: boolean; message: string }> {
  const isEligible = await checkWeeklyChallengeEligibility(userId, challenge);

  if (!isEligible) {
    const messages: Record<string, string> = {
      goals_days: `Complete all goals on ${challenge.required_value} days this week first!`,
      gems_earned: `Earn ${challenge.required_value} gems this week first!`,
      place_buildings: `Place ${challenge.required_value} buildings this week first!`,
      streak: `You need at least a ${challenge.required_value} day streak!`,
    };
    return {
      success: false,
      message: messages[challenge.challenge_type] ?? 'Requirements not met yet!',
    };
  }

  const { error } = await supabase
    .from('user_weekly_challenge_completions')
    .insert({
      user_id: userId,
      challenge_id: challenge.id,
      gems_earned: challenge.gem_reward,
    });

  if (error) {
    if (error.code === '23505') return { success: false, message: 'Already completed this week!' };
    return { success: false, message: 'Something went wrong.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gem_balance, total_gems_earned')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    await supabase.from('profiles').update({
      gem_balance: profile.gem_balance + challenge.gem_reward,
      total_gems_earned: profile.total_gems_earned + challenge.gem_reward,
    }).eq('id', userId);
  }

  return { success: true, message: `+${challenge.gem_reward} gems earned!` };
}
