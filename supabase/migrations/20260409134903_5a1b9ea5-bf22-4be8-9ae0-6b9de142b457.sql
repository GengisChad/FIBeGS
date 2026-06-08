ALTER TABLE public.changelog_entries ADD COLUMN scope text NOT NULL DEFAULT 'user';

-- Update existing admin-related entries
UPDATE public.changelog_entries SET scope = 'admin' WHERE title ILIKE '%admin%' OR title ILIKE '%pannello%' OR description ILIKE '%admin%' OR description ILIKE '%pannello%';