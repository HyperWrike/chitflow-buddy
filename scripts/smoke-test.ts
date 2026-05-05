import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function runTest() {
  console.log("Resetting dispatch logs for 918885145807 to pending...");
  
  // Find logs for 918885145807
  const { data: logs, error } = await supabase
    .from('dispatch_log')
    .select('id')
    .eq('whatsapp_number', '918885145807')
    .limit(1);

  if (error || !logs || logs.length === 0) {
    console.error("Could not find a dispatch log for 918885145807", error);
    return;
  }

  // Set it to pending
  await supabase
    .from('dispatch_log')
    .update({ status: 'pending' })
    .eq('id', logs[0].id);

  console.log("Log reset. Running worker script...");
  
  try {
    const output = execSync('npx tsx scripts/whatsapp-cron.ts run', { encoding: 'utf-8' });
    console.log("Worker output:");
    console.log(output);
  } catch (err: any) {
    console.error("Worker failed:", err.stdout);
    console.error(err.stderr);
  }
}

runTest();
