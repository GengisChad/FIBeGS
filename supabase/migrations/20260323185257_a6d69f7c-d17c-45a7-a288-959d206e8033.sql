
-- Delete all spam mention notifications from that specific post
DELETE FROM notifications WHERE type = 'mention' AND link = '/forum/d3ce0a60-0236-473d-93fe-ac8204b2ba77';
