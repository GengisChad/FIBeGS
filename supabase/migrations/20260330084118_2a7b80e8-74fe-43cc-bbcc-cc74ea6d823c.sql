-- Remove duplicate/redundant indexes to reduce write overhead and storage

-- notifications: idx_notifications_push_pending_v2 is identical to idx_notifications_push_pending
DROP INDEX IF EXISTS idx_notifications_push_pending_v2;

-- notifications: idx_notifications_user_created_desc is identical to idx_notifications_user_created
DROP INDEX IF EXISTS idx_notifications_user_created_desc;

-- notifications: idx_notifications_user_id is covered by idx_notifications_user_created (user_id is first column)
DROP INDEX IF EXISTS idx_notifications_user_id;

-- notifications: idx_notifications_user_read is covered by idx_notifications_user_unread for unread queries
-- and by idx_notifications_user_created for general user queries
DROP INDEX IF EXISTS idx_notifications_user_read;

-- push_subscriptions: idx_push_subscriptions_user_id is identical to idx_push_subscriptions_user
DROP INDEX IF EXISTS idx_push_subscriptions_user_id;

-- push_subscriptions: idx_push_subscriptions_user is covered by push_subscriptions_user_id_endpoint_key
DROP INDEX IF EXISTS idx_push_subscriptions_user;