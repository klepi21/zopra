-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (synced from Clerk via webhook)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,           -- 6-char join code e.g. "AB12CD"
  status TEXT DEFAULT 'waiting',       -- waiting | starting | active | finished
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  round_count INTEGER NOT NULL,        -- 3, 5, or 7
  current_round INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Room Players (junction)
CREATE TABLE IF NOT EXISTS room_players (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  is_ready BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Rounds
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  letter CHAR(1) NOT NULL,
  status TEXT DEFAULT 'active',        -- active | validating | scoring | done
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Answers
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  answer_raw TEXT NOT NULL,
  answer_normalized TEXT NOT NULL,
  is_valid BOOLEAN,
  validated_by TEXT,                   -- 'ai' | 'community' | 'ai+community'
  points_awarded INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (round_id, user_id, category)
);

-- Votes (community validation)
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES answers(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote BOOLEAN NOT NULL,               -- true = valid, false = invalid
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (answer_id, voter_id)
);

-- Game Settings (all tunable from DB, no redeployment needed)
CREATE TABLE IF NOT EXISTS game_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO game_settings (key, value) VALUES
  ('time_per_category', '"12"'),
  ('round_options', '[3, 5, 7]'),
  ('max_players', '10'),
  ('min_players', '2'),
  ('scoring_unique', '10'),
  ('scoring_shared', '5'),
  ('scoring_blank', '0'),
  ('voting_window_seconds', '30'),
  ('excluded_letters', '["Ψ", "Ξ", "Θ"]'),
  ('categories', '["Όνομα", "Ζώο", "Πράγμα", "Χώρα", "Πόλη", "Επάγγελμα"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
