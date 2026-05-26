import { supabase } from './src/lib/supabase';

async function main() {
  console.log('Testing inserting a row with a habit_id...');
  const testId = '4fc7fd8d-0123-4567-89ab-cdef01234567'; // random uuid
  const { data, error } = await supabase.from('activities').insert({
    name: 'Test Activity Layout Checks',
    user_id: '00000000-0000-0000-0000-000000000000', // standard empty uuid or similar
    habit_id: testId
  }).select();
  
  if (error) {
    console.log('Insert error pattern:', error.message);
  } else {
    console.log('Insert success! habit_id resides in the table!', data);
    // Cleanup if succeeded
    if (data && data[0]?.id) {
       await supabase.from('activities').delete().eq('id', data[0].id);
    }
  }
}

main();
