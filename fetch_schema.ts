import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://jphoqyaksuhirxhuggxr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwaG9xeWFrc3VoaXJ4aHVnZ3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDY5MzIsImV4cCI6MjA5NDM4MjkzMn0.vs15IwIj3o64jByd_kWQSudbEUd_bbxfKX7D7fbZxYU'
);
async function run() {
  const payloadToInsert = { 
    user_id: '965f3f4e-28b9-4702-b236-40fbdff734de', 
    name: 'test_avoid',
    habit_mode: 'avoid',
    avoidance_target: 'test',
    avoidance_scope: 'full_day'
  };
  const { error } = await supabase.from('habits').insert([payloadToInsert]);
  console.log("Error inserting into habits:", error);
}
run();
