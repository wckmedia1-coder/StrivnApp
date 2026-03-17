/*
  # Strivn Database Schema

  ## Overview
  Complete database schema for Strivn gamified productivity platform.

  ## Tables Created

  ### 1. profiles
  Extended user profile data linked to auth.users
  - id (uuid, references auth.users)
  - username (unique, required)
  - streak_count (tracks consecutive days)
  - last_active_date (for streak calculation)
  - gem_balance (total gems earned minus spent)
  - total_gems_earned (lifetime earnings)
  - created_at (timestamp)

  ### 2. goals
  User's goal templates (recurring or one-time)
  - id (uuid, primary key)
  - user_id (references profiles)
  - title (goal description)
  - is_recurring (boolean)
  - is_active (boolean, for soft delete)
  - created_at (timestamp)

  ### 3. daily_goal_instances
  Daily completion tracking for each goal
  - id (uuid, primary key)
  - goal_id (references goals)
  - user_id (references profiles)
  - date (date)
  - completed (boolean)
  - completed_at (timestamp)
  - gems_earned (number, varies with streak)

  ### 4. cities
  User's city progression and state
  - id (uuid, primary key)
  - user_id (references profiles, unique)
  - world_level (current world)
  - total_gems_spent (lifetime spending)
  - is_decayed (decay state flag)
  - last_maintenance_date (for decay calculation)
  - created_at (timestamp)

  ### 5. buildings
  Placed buildings in user's city
  - id (uuid, primary key)
  - city_id (references cities)
  - building_type (string)
  - position_x (integer)
  - position_y (integer)
  - level (integer)
  - is_damaged (boolean)
  - repair_cost (integer)
  - created_at (timestamp)

  ### 6. posts
  Social achievement posts
  - id (uuid, primary key)
  - user_id (references profiles)
  - post_type (achievement type)
  - content (sanitized text)
  - metadata (jsonb for streak count, world level, etc)
  - created_at (timestamp)

  ### 7. comments
  Comments on posts
  - id (uuid, primary key)
  - post_id (references posts)
  - user_id (references profiles)
  - content (sanitized text)
  - created_at (timestamp)

  ### 8. likes
  Likes on posts
  - user_id (references profiles)
  - post_id (references posts)
  - created_at (timestamp)
  - Primary key: (user_id, post_id)

  ### 9. friendships
  Friend relationships between users
  - user_id (references profiles)
  - friend_id (references profiles)
  - status (pending, accepted, blocked)
  - created_at (timestamp)
  - Primary key: (user_id, friend_id)

  ## Security
  All tables have Row Level Security (RLS) enabled with appropriate policies:
  - Users can read their own data
  - Users can update their own data
  - Users can read public social content
  - Friend-related data respects friendship status
*/

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  streak_count integer DEFAULT 0,
  last_active_date date,
  gem_balance integer DEFAULT 0,
  total_gems_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_recurring boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create daily_goal_instances table
CREATE TABLE IF NOT EXISTS daily_goal_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  gems_earned integer DEFAULT 0,
  UNIQUE(goal_id, date)
);

ALTER TABLE daily_goal_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal instances"
  ON daily_goal_instances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal instances"
  ON daily_goal_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goal instances"
  ON daily_goal_instances FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  world_level integer DEFAULT 1,
  total_gems_spent integer DEFAULT 0,
  is_decayed boolean DEFAULT false,
  last_maintenance_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own city"
  ON cities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own city"
  ON cities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own city"
  ON cities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  position_x integer NOT NULL,
  position_y integer NOT NULL,
  level integer DEFAULT 1,
  is_damaged boolean DEFAULT false,
  repair_cost integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own buildings"
  ON buildings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cities
      WHERE cities.id = buildings.city_id
      AND cities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own buildings"
  ON buildings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cities
      WHERE cities.id = city_id
      AND cities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own buildings"
  ON buildings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cities
      WHERE cities.id = buildings.city_id
      AND cities.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cities
      WHERE cities.id = city_id
      AND cities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own buildings"
  ON buildings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cities
      WHERE cities.id = buildings.city_id
      AND cities.user_id = auth.uid()
    )
  );

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_type text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view likes"
  ON likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own likes"
  ON likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_goal_instances_user_date ON daily_goal_instances(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_goal_instances_goal_date ON daily_goal_instances(goal_id, date);
CREATE INDEX IF NOT EXISTS idx_cities_user_id ON cities(user_id);
CREATE INDEX IF NOT EXISTS idx_buildings_city_id ON buildings(city_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);