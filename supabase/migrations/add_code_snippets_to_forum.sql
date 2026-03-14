-- Database Migration: Add Code Snippet support to Forum
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Add code_content to forum_posts
ALTER TABLE public.forum_posts 
ADD COLUMN IF NOT EXISTS code_content TEXT;

-- Add code_content to forum_replies
ALTER TABLE public.forum_replies 
ADD COLUMN IF NOT EXISTS code_content TEXT;

-- Verify columns
COMMENT ON COLUMN public.forum_posts.code_content IS 'Optional Lua code snippet attached to the post';
COMMENT ON COLUMN public.forum_replies.code_content IS 'Optional Lua code snippet attached to the reply';
