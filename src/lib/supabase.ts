import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  streak_count: number;
  last_active_date: string | null;
  gem_balance: number;
  total_gems_earned: number;
  total_goals_completed: number;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  is_recurring: boolean;
  is_active: boolean;
  created_at: string;
};

export type DailyGoalInstance = {
  id: string;
  goal_id: string;
  user_id: string;
  date: string;
  completed: boolean;
  completed_at: string | null;
  gems_earned: number;
};

export type City = {
  id: string;
  user_id: string;
  world_level: number;
  total_gems_spent: number;
  is_decayed: boolean;
  last_maintenance_date: string;
  created_at: string;
};

export type Building = {
  id: string;
  city_id: string;
  building_type: string;
  position_x: number;
  position_y: number;
  level: number;
  is_damaged: boolean;
  repair_cost: number;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  post_type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: Profile;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
};
