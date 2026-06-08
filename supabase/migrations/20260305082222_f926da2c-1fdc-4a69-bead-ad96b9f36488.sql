ALTER TABLE tournaments ADD COLUMN groups_count integer DEFAULT 0;
ALTER TABLE tournament_standings ADD COLUMN group_number integer;
ALTER TABLE tournament_matches ADD COLUMN group_number integer;