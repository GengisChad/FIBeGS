
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS profiles_username_key;
CREATE UNIQUE INDEX profiles_username_unique_lower ON profiles (lower(username));
