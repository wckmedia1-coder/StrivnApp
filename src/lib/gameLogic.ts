import { supabase } from './supabase';

export type BuildingType = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  maxPerWorld: number[];  // max allowed per world [w1, w2, w3, w4, w5]
  unlocksAtWorld: number; // which world it becomes available
};

export const buildingTypes: BuildingType[] = [
  { id: 'tree',      name: 'Tree',      emoji: '🌳', cost: 5,  maxPerWorld: [3,4,4,5,6],  unlocksAtWorld: 1 },
  { id: 'house',     name: 'House',     emoji: '🏠', cost: 10, maxPerWorld: [4,5,5,6,7],  unlocksAtWorld: 1 },
  { id: 'shop',      name: 'Shop',      emoji: '🏪', cost: 15, maxPerWorld: [2,3,4,5,6],  unlocksAtWorld: 1 },
  { id: 'apartment', name: 'Apartment', emoji: '🏢', cost: 25, maxPerWorld: [2,3,4,5,6],  unlocksAtWorld: 1 },
  { id: 'tower',     name: 'Tower',     emoji: '🏙️', cost: 40, maxPerWorld: [1,2,2,3,4],  unlocksAtWorld: 1 },
  { id: 'fountain',  name: 'Fountain',  emoji: '⛲', cost: 20, maxPerWorld: [0,1,2,3,4],  unlocksAtWorld: 2 },
  { id: 'school',    name: 'School',    emoji: '🏫', cost: 30, maxPerWorld: [0,1,1,2,3],  unlocksAtWorld: 2 },
  { id: 'hospital',  name: 'Hospital',  emoji: '🏥', cost: 35, maxPerWorld: [0,1,1,2,3],  unlocksAtWorld: 2 },
  { id: 'bridge',    name: 'Bridge',    emoji: '🌉', cost: 45, maxPerWorld: [0,0,1,2,3],  unlocksAtWorld: 3 },
  { id: 'theatre',   name: 'Theatre',   emoji: '🎭', cost: 50, maxPerWorld: [0,0,1,1,2],  unlocksAtWorld: 3 },
  { id: 'bank',      name: 'Bank',      emoji: '🏦', cost: 40, maxPerWorld: [0,0,1,2,3],  unlocksAtWorld: 3 },
];

export const worldSlots: number[] = [12, 16, 20, 24, 28];

export function getMaxForBuilding(typeId: string, worldLevel: number): number {
  const type = buildingTypes.find(t => t.id === typeId);
  if (!type) return 0;
  const idx = Math.min(worldLevel - 1, type.maxPerWorld.length - 1);
  return type.maxPerWorld[idx];
}

export function getAvailableBuildings(worldLevel: number): BuildingType[] {
  return buildingTypes.filter(t => t.unlocksAtWorld <= worldLevel);
}

export function getTotalSlotsForWorld(worldLevel: number): number {
  return worldSlots[Math.min(worldLevel - 1, worldSlots.length - 1)];
}

export function getRemainingAllowed(
  typeId: string,
  worldLevel: number,
  existingBuildings: { building_type: string }[]
): number {
  const max = getMaxForBuilding(typeId, worldLevel);
  const current = existingBuildings.filter(b => b.building_type === typeId).length;
  return Math.max(0, max - current);
}

export async function calculateStreak(userId: string, currentDate: string): Promise<number> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_active_date, streak_count')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return 0;

  const lastActiveDate = profile.last_active_date;

  if (!lastActiveDate) {
    await supabase.from('profiles').update({ streak_count: 1, last_active_date: currentDate }).eq('id', userId);
    return 1;
  }

  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastActiveDate === yesterdayStr) {
    const newStreak = profile.streak_count + 1;
    await supabase.from('profiles').update({ streak_count: newStreak, last_active_date: currentDate }).eq('id', userId);
    return newStreak;
  } else if (lastActiveDate === currentDate) {
    return profile.streak_count;
  } else {
    await supabase.from('profiles').update({ streak_count: 1, last_active_date: currentDate }).eq('id', userId);
    await supabase.from('cities').update({ is_decayed: true }).eq('user_id', userId);
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
    const { data: city } = await supabase.from('cities').select('id').eq('user_id', userId).maybeSingle();
    if (city) {
      const repairCost = Math.min(daysDiff * 5, 50);
      await supabase.from('cities').update({ is_decayed: true }).eq('user_id', userId);
      await supabase.from('buildings').update({ is_damaged: true, repair_cost: repairCost }).eq('city_id', city.id);
    }
  }
}

export async function repairCity(userId: string): Promise<{ success: boolean; cost: number }> {
  const { data: profile } = await supabase.from('profiles').select('gem_balance').eq('id', userId).maybeSingle();
  const { data: city } = await supabase.from('cities').select('id, total_gems_spent').eq('user_id', userId).maybeSingle();

  if (!profile || !city) return { success: false, cost: 0 };

  const { data: buildings } = await supabase.from('buildings').select('repair_cost').eq('city_id', city.id).eq('is_damaged', true);
  const totalCost = buildings?.reduce((sum, b) => sum + b.repair_cost, 0) || 0;

  if (profile.gem_balance < totalCost) return { success: false, cost: totalCost };

  await supabase.from('profiles').update({ gem_balance: profile.gem_balance - totalCost }).eq('id', userId);
  await supabase.from('cities').update({ is_decayed: false, total_gems_spent: city.total_gems_spent + totalCost }).eq('user_id', userId);
  await supabase.from('buildings').update({ is_damaged: false, repair_cost: 0 }).eq('city_id', city.id);

  return { success: true, cost: totalCost };
}
