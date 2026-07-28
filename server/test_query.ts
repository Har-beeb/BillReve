import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tftgkvovzntfkymvbwdz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdGdrdm92em50Zmt5bXZid2R6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM3NjI3MiwiZXhwIjoyMDk4OTUyMjcyfQ.iT63zZASMt5Dl-j2Y-c4DtV3yMbW3tRYSqxGbymvmSY';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .not('email_flags->welcome_sent', 'eq', 'true');
  console.log('Error:', JSON.stringify(error, null, 2));
  console.log('Data:', data?.length);
  if (data?.length) {
     console.log('First user:', data[0].email, data[0].email_flags);
  }
}
test();
