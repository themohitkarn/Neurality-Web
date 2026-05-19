-- =========================================================================
--             NEURALITY HIGH-PERFORMANCE POSTGRESQL INDEX MIGRATIONS
-- =========================================================================
-- This script contains all necessary production indices to resolve missing 
-- indices, speed up reverse joins, array filters, and descending order feeds.
-- Expose these queries to run on your Neon console.

-- 1. Optimize reverse lookups on composite association tables
-- Composite primary key is (follower_id, followed_id) - queries on followed_id need this:
CREATE INDEX IF NOT EXISTS idx_followers_followed_id ON followers(followed_id);

-- Composite primary key is (user_id, post_id/reel_id) - queries on post_id/reel_id need these:
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel_id ON reel_likes(reel_id);

CREATE INDEX IF NOT EXISTS idx_post_reposts_post_id ON post_reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_reel_reposts_reel_id ON reel_reposts(reel_id);

-- 2. Optimize user watch-history lookups in recommendation candidate generation
-- Unique constraint is on (reel_id, user_id) - queries on user_id alone need this index:
CREATE INDEX IF NOT EXISTS idx_reel_views_user_id ON reel_views(user_id);
CREATE INDEX IF NOT EXISTS idx_reel_views_reel_id ON reel_views(reel_id);

-- 3. Optimize tag candidate pool lookups (reels have a tags array column)
-- A GIN (Generalized Inverted Index) allows instant array element lookups:
CREATE INDEX IF NOT EXISTS idx_reels_tags ON reels USING GIN (tags);

-- 4. Optimize descending order pagination feeds (removes sorting overhead)
CREATE INDEX IF NOT EXISTS idx_reels_created_at_desc ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);

-- =========================================================================
-- Run this on your Neon Database Console or via psycopg2 to apply.
-- =========================================================================
