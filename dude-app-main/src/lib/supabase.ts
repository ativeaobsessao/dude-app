import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wckuqhzjzqcndlrvdlaz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indja3VxaHpqenFjbmRscnZkbGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDA1OTcsImV4cCI6MjEwMjIxNjU5N30.6vuwMEpxcKytJ5RBdj_JLfeLbnHyohmUB3iqgnVo52A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
