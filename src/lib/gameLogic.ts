import { supabase } from './supabase';

// ─── Goal Categories ──────────────────────────────────────────────────────────

export type GoalCategory =
  | 'fitness'
  | 'reading'
  | 'mindfulness'
  | 'creativity'
  | 'sleep'
  | 'nutrition'
  | 'general';

export type CategoryMeta = {
  id: GoalCategory;
  label: string;
  emoji: string;
  description: string;
  keywords: string[];
};

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'fitness',
    label: 'Fitness',
    emoji: '💪',
    description: 'Running, gym, sport, exercise',
    keywords: [
      'run', 'running', 'jog', 'walk', 'gym', 'workout', 'exercise', 'lift',
      'weights', 'swim', 'swimming', 'cycle', 'cycling', 'bike', 'sport',
      'yoga', 'stretch', 'pushup', 'pull-up', 'squat', 'hike', 'hiking',
      'miles', 'steps', 'training', 'cardio', 'fitness', 'crossfit', 'rowing',
    ],
  },
  {
    id: 'reading',
    label: 'Reading',
    emoji: '📚',
    description: 'Books, articles, learning',
    keywords: [
      'read', 'reading', 'book', 'books', 'chapter', 'pages', 'novel',
      'article', 'study', 'studying', 'learn', 'learning', 'course', 'lesson',
      'podcast', 'audiobook', 'library', 'research', 'knowledge',
    ],
  },
  {
    id: 'mindfulness',
    label: 'Mindfulness',
    emoji: '🧘',
    description: 'Meditation, journaling, mental health',
    keywords: [
      'meditat', 'meditation', 'mindful', 'journal', 'journaling', 'breathe',
      'breathing', 'calm', 'relax', 'gratitude', 'reflect', 'mental', 'therapy',
      'anxiety', 'stress', 'peace', 'quiet', 'prayer', 'spiritual', 'focus',
    ],
  },
  {
    id: 'creativity',
    label: 'Creativity',
    emoji: '🎨',
    description: 'Art, music, writing, building',
    keywords: [
      'draw', 'drawing', 'paint', 'painting', 'art', 'music', 'play guitar',
      'piano', 'instrument', 'write', 'writing', 'blog', 'code', 'coding',
      'build', 'create', 'design', 'craft', 'photography', 'film', 'video',
      'sing', 'dance', 'sketch', 'sculpt',
    ],
  },
  {
    id: 'sleep',
    label: 'Sleep',
    emoji: '😴',
    description: 'Sleep schedule, rest, recovery',
    keywords: [
      'sleep', 'sleeping', 'bed', 'bedtime', 'wake', 'wake up', 'rest',
      'nap', 'recover', 'recovery', 'routine', 'morning', 'night',
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    emoji: '🥗',
    description: 'Diet, eating habits, hydration',
    keywords: [
      'eat', 'eating', 'food', 'diet', 'meal', 'cook', 'cooking', 'water',
      'drink', 'hydrat', 'vegetable', 'fruit', 'healthy', 'calorie', 'fast',
      'fasting', 'breakfast', 'lunch', 'dinner', 'snack', 'protein', 'vegan',
    ],
  },
];

export function detectCategory(title: string): GoalCategory {
  const lower = title.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) return cat.id;
    }
  }
  return 'general';
}

// ─── Trait Levels ─────────────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [0, 3, 7, 15, 25, 40];
export const MAX_LEVEL = 5;

export function getLevelForCompletions(completions: number): number {
  let level = 0;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (completions >= LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

export function getProgressToNextLevel(completions: number): {
  level: number;
  progress: number;
  completionsInLevel: number;
  completionsNeeded: number;
} {
  const level = getLevelForCompletions(completions);
  if (level >= MAX_LEVEL) {
    return { level, progress: 1, completionsInLevel: 0, completionsNeeded: 0 };
  }
  const current = LEVEL_THRESHOLDS[level];
  const next = LEVEL_THRESHOLDS[level + 1];
  const completionsInLevel = completions - current;
  const completionsNeeded = next - current;
  return {
    level,
    progress: completionsInLevel / completionsNeeded,
    completionsInLevel,
    completionsNeeded,
  };
}

// ─── Character Trait DB Helpers ───────────────────────────────────────────────

export type CharacterTrait = {
  id: string;
  character_id: string;
  user_id: string;
  category: GoalCategory;
  completions: number;
  level: number;
};

export async function incrementTrait(
  userId: string,
  category: GoalCategory
): Promise<{ newLevel: number; leveledUp: boolean }> {
  let { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!character) {
    const { data: newChar } = await supabase
      .from('characters')
      .insert({ user_id: userId })
      .select()
      .single();
    character = newChar;
  }

  if (!character) return { newLevel: 0, leveledUp: false };

  const { data: existing } = await supabase
    .from('character_traits')
    .select('*')
    .eq('character_id', character.id)
    .eq('category', category)
    .maybeSingle();

  const oldLevel = existing?.level ?? 0;
  const newCompletions = (existing?.completions ?? 0) + 1;
  const newLevel = getLevelForCompletions(newCompletions);

  if (existing) {
    await supabase
      .from('character_traits')
      .update({ completions: newCompletions, level: newLevel })
      .eq('id', existing.id);
  } else {
    await supabase.from('character_traits').insert({
      character_id: character.id,
      user_id: userId,
      category,
      completions: newCompletions,
      level: newLevel,
    });
  }

  return { newLevel, leveledUp: newLevel > oldLevel };
}

export async function loadCharacterTraits(userId: string): Promise<CharacterTrait[]> {
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!character) return [];

  const { data: traits } = await supabase
    .from('character_traits')
    .select('*')
    .eq('character_id', character.id);

  return (traits ?? []) as CharacterTrait[];
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
    const traits = await loadCharacterTraits(userId);
    for (const trait of traits) {
      const reduced = Math.max(0, trait.completions - daysDiff);
      const newLevel = getLevelForCompletions(reduced);
      await supabase
        .from('character_traits')
        .update({ completions: reduced, level: newLevel })
        .eq('id', trait.id);
    }
  }
}

// ─── XP Level System ─────────────────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return Math.round(3 * Math.pow(1.5, level - 1));
}

export function getLevelFromXp(totalXp: number): { level: number; xpInLevel: number; xpNeeded: number } {
  let level = 1;
  let remaining = totalXp;
  while (true) {
    const needed = xpToNextLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpNeeded: needed };
    remaining -= needed;
    level++;
  }
}
