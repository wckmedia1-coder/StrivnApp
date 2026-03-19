import { supabase } from './supabase';

export type PassiveIncomeResult = {
  gemsEarned: number;
  hoursAccumulated: number;
  buildingCount: number;
};

const GEMS_PER_HOUR: Record<string, number> = {
  tree:      0.05,
  house:     0.10,
  shop:      0.15,
  apartment: 0.20,
  tower:     0.40,
  fountain:  0.10,
  school:    0.25,
  hospital:  0.25,
  bridge:    0.15,
  theatre:   0.30,
  bank:      0.35,
};

const MAX_HOURS = 24;

export async function calculatePassiveIncome(userId: string): Promise<PassiveIncomeResult> {
  // Get city
  const { data: city } = await supabase
    .from('cities')
    .select('id, last_collected_at, is_decayed')
    .eq('user_id', userId)
    .maybeSingle();

  if (!city) return { gemsEarned: 0, hoursAccumulated: 0, buildingCount: 0 };

  // If city is decayed, no passive income
  if (city.is_decayed) return { gemsEarned: 0, hoursAccumulated: 0, buildingCount: 0 };

  // Get all healthy buildings
  const { data: buildings } = await supabase
    .from('buildings')
    .select('building_type, is_damaged')
    .eq('city_id', city.id)
    .eq('is_damaged', false);

  if (!buildings || buildings.length === 0) {
    return { gemsEarned: 0, hoursAccumulated: 0, buildingCount: 0 };
  }

  // Calculate hours since last collection (cap at MAX_HOURS)
  const lastCollected = city.last_collected_at
    ? new Date(city.last_collected_at)
    : new Date();
  const now = new Date();
  const hoursDiff = Math.min(
    (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60),
    MAX_HOURS
  );

  // Calculate gems per hour from all healthy buildings
  const gemsPerHour = buildings.reduce((sum, b) => {
    return sum + (GEMS_PER_HOUR[b.building_type] ?? 0);
  }, 0);

  const gemsEarned = Math.floor(gemsPerHour * hoursDiff * 10) / 10;

  return {
    gemsEarned,
    hoursAccumulated: Math.round(hoursDiff * 10) / 10,
    buildingCount: buildings.length,
  };
}

export async function collectPassiveIncome(userId: string): Promise<{ collected: number }> {
  const { gemsEarned } = await calculatePassiveIncome(userId);

  if (gemsEarned <= 0) return { collected: 0 };

  // Round down to nearest 0.5
  const rounded = Math.floor(gemsEarned * 2) / 2;
  if (rounded <= 0) return { collected: 0 };

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('gem_balance, total_gems_earned')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { collected: 0 };

  // Update profile gems
  await supabase.from('profiles').update({
    gem_balance: profile.gem_balance + rounded,
    total_gems_earned: profile.total_gems_earned + rounded,
  }).eq('id', userId);

  // Update last collected timestamp
  await supabase.from('cities').update({
    last_collected_at: new Date().toISOString(),
    pending_gems: 0,
  }).eq('user_id', userId);

  return { collected: rounded };
}

export function getGemsPerHour(buildings: { building_type: string; is_damaged: boolean }[]): number {
  return buildings
    .filter(b => !b.is_damaged)
    .reduce((sum, b) => sum + (GEMS_PER_HOUR[b.building_type] ?? 0), 0);
}
