-- Performance indexes — run once in Supabase SQL editor.
-- These cover the most frequent query patterns at scale.

-- Matches endpoint: room_players lookup by user
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON room_players(user_id);

-- Global stats: COUNT on rooms by status
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- Global stats: COUNT on answers by validity
CREATE INDEX IF NOT EXISTS idx_answers_is_valid ON answers(is_valid);

-- Game persistence: round lookup by room
CREATE INDEX IF NOT EXISTS idx_rounds_room_id ON rounds(room_id);

-- Answer lookup by round (used during save and vote queries)
CREATE INDEX IF NOT EXISTS idx_answers_round_id ON answers(round_id);
