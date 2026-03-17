import { supabase } from './supabase';

export async function calculateStreak(userId: string, currentDate: string): Promise<number> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_active_date, streak_count')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return 0;

  const lastActiveDate = profile.last_active_date;

  if (!lastActiveDate) {
    await supabase
      .from('profiles')
      .update({
        streak_count: 1,
        last_active_date: currentDate,
      })
      .eq('id', userId);
    return 1;
  }

  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastActiveDate === yesterdayStr) {
    const newStreak = profile.streak_count + 1;
    await supabase
      .from('profiles')
      .update({
        streak_count: newStreak,
        last_active_date: currentDate,
      })
      .eq('id', userId);
    return newStreak;
  } else if (lastActiveDate === currentDate) {
    return profile.streak_count;
  } else {
    await supabase
      .from('profiles')
      .update({
        streak_count: 1,
        last_active_date: currentDate,
      })
      .eq('id', userId);

    await supabase
      .from('cities')
      .update({
        is_decayed: true,
      })
      .eq('user_id', userId);

    return 1;
  }
}

export async function checkAndApplyDecay(userId: string, currentDate: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_active_date')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || !profile.last_active_date) return;

  const lastActive = new Date(profile.last_active_date);
  const current = new Date(currentDate);
  const daysDiff = Math.floor((current.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 1) {
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (city) {
      const repairCost = Math.min(daysDiff * 5, 50);

      await supabase
        .from('cities')
        .update({
          is_decayed: true,
        })
        .eq('user_id', userId);

      await supabase
        .from('buildings')
        .update({
          is_damaged: true,
          repair_cost: repairCost,
        })
        .eq('city_id', city.id);
    }
  }
}

export async function repairCity(userId: string): Promise<{ success: boolean; cost: number }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('gem_balance')
    .eq('id', userId)
    .maybeSingle();

  const { data: city } = await supabase
    .from('cities')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile || !city) {
    return { success: false, cost: 0 };
  }

  const { data: buildings } = await supabase
    .from('buildings')
    .select('repair_cost')
    .eq('city_id', city.id)
    .eq('is_damaged', true);

  const totalCost = buildings?.reduce((sum, b) => sum + b.repair_cost, 0) || 0;

  if (profile.gem_balance < totalCost) {
    return { success: false, cost: totalCost };
  }

  await supabase
    .from('profiles')
    .update({
      gem_balance: profile.gem_balance - totalCost,
    })
    .eq('id', userId);

  await supabase
    .from('cities')
    .update({
      is_decayed: false,
      total_gems_spent: city.id ? (await supabase.from('cities').select('total_gems_spent').eq('id', city.id).maybeSingle()).data?.total_gems_spent + totalCost : totalCost,
    })
    .eq('user_id', userId);

  await supabase
    .from('buildings')
    .update({
      is_damaged: false,
      repair_cost: 0,
    })
    .eq('city_id', city.id);

  return { success: true, cost: totalCost };
}

export const buildingTypes = [
  { id: 'house', name: 'House', cost: 10, emoji: '🏠' },
  { id: 'shop', name: 'Shop', cost: 15, emoji: '🏪' },
  { id: 'tree', name: 'Tree', cost: 5, emoji: '🌳' },
  { id: 'park', name: 'Park', cost: 20, emoji: '🏞️' },
  { id: 'tower', name: 'Tower', cost: 30, emoji: '🏢' },
  { id: 'fountain', name: 'Fountain', cost: 25, emoji: '⛲' },
];
