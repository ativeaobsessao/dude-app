import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://jphoqyaksuhirxhuggxr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwaG9xeWFrc3VoaXJ4aHVnZ3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDY5MzIsImV4cCI6MjA5NDM4MjkzMn0.vs15IwIj3o64jByd_kWQSudbEUd_bbxfKX7D7fbZxYU'
);
