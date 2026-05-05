import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function run() {
  console.log("Checking DB connection...");
  const { data, error } = await supabase.from('subscribers').select('id').limit(1);
  if (error) {
    console.error("Error querying subscribers:", error.message);
  } else {
    console.log("DB connected! Subscribers table exists.");
  }
}
run();
