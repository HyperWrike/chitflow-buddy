import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aiSensyApiKey = process.env.AISENSY_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Formatting helpers
function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN').format(Math.round(amount));
}

function getPeriod(startMonth: string, currentMonth: string): number {
  if (!startMonth) return 1;
  const start = new Date(startMonth + "-01");
  const current = new Date(currentMonth + "-01");
  let months = (current.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += current.getMonth();
  return months < 0 ? 0 : months + 1;
}

function formatMonth(monthCode: string) {
  if (!monthCode) return "";
  const d = new Date(monthCode + "-01");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Ensure the bucket exists (if not, you need to create it manually as public)
async function uploadToStorage(buffer: Buffer, filename: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('statements')
    .upload(`monthly/${filename}`, buffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('statements')
    .getPublicUrl(`monthly/${filename}`);

  return publicUrlData.publicUrl;
}

async function sendAiSensyMessage(phone: string, name: string, imageUrl: string) {
  if (!aiSensyApiKey) {
    console.warn("No AISENSY_API_KEY found, skipping actual WhatsApp dispatch");
    return;
  }

  // NOTE: AiSensy requires a pre-approved template name to initiate a conversation.
  // We use a placeholder 'monthly_statement' here. Make sure your actual campaign in AiSensy matches this.
  const campaignName = "monthly_statement";
  
  // Format phone number (remove non-digits, ensure country code)
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

  const payload = {
    apiKey: aiSensyApiKey,
    campaignName: campaignName,
    destination: cleanPhone,
    userName: name,
    media: {
      url: imageUrl,
      filename: "statement.png"
    }
  };

  const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AiSensy API Error: ${response.status} ${text}`);
  }
  
  return await response.json();
}

async function processPendingDispatches() {
  console.log("Starting dispatch processor...");

  // 1. Fetch pending dispatches
  const { data: pendingLogs, error: logError } = await supabase
    .from('dispatch_log')
    .select('*')
    .eq('status', 'pending');

  if (logError) {
    console.error("Error fetching dispatch logs:", logError);
    return;
  }

  if (!pendingLogs || pendingLogs.length === 0) {
    console.log("No pending statements to dispatch.");
    return;
  }

  console.log(`Found ${pendingLogs.length} pending statements.`);

  // Setup Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Read EJS Template
  const templatePath = path.join(__dirname, 'template.ejs');
  const templateHtml = await fs.readFile(templatePath, 'utf-8');

  for (const log of pendingLogs) {
    try {
      console.log(`Processing subscriber ${log.subscriber_id} for month ${log.month}...`);

      // 2. Fetch subscriber details
      const { data: subscriber, error: subError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('id', log.subscriber_id)
        .single();
      
      if (subError || !subscriber) throw new Error("Subscriber not found");

      // 3. Fetch all member dues for this subscriber in the given month
      const { data: dues, error: duesError } = await supabase
        .from('member_dues')
        .select(`
          previous_bid,
          share_of_discount,
          chit_amount_due,
          subscriptions!inner(
            name_on_chit, prized,
            chit_groups!inner(group_code, chit_value, duration_months, auction_day, auction_time, start_month)
          ),
          monthly_entries!inner(month)
        `)
        .eq('monthly_entries.month', log.month)
        .eq('subscriptions.subscriber_id', log.subscriber_id);

      if (duesError || !dues || dues.length === 0) {
        throw new Error("No dues found for this subscriber in this month");
      }

      // Format rows for EJS
      let totalDue = 0;
      let auctionTime = "5.00 PM"; // Default

      const rows = dues.map((d: any) => {
        const group = d.subscriptions.chit_groups;
        totalDue += Number(d.chit_amount_due);
        auctionTime = group.auction_time || auctionTime;

        const currentPeriod = getPeriod(group.start_month, log.month);

        return {
          auction_day: group.auction_day,
          group_code: group.group_code,
          name_on_chit: d.subscriptions.name_on_chit,
          prized: d.subscriptions.prized,
          chit_value: Number(group.chit_value),
          previous_bid: Number(d.previous_bid || 0),
          share_of_discount: Number(d.share_of_discount),
          period: `${currentPeriod} / ${group.duration_months}`,
          amount_due: Number(d.chit_amount_due)
        };
      });

      // 4. Render HTML
      const renderedHtml = ejs.render(templateHtml, {
        subscriber,
        monthName: formatMonth(log.month),
        auctionTime,
        rows,
        totalDue,
        formatINR
      });

      // 5. Take Screenshot
      const page = await browser.newPage();
      await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
      const buffer = await page.screenshot({ fullPage: true });
      await page.close();

      // 6. Upload to Supabase Storage
      const filename = `${subscriber.access_code}_${log.month}_${Date.now()}.png`;
      const imageUrl = await uploadToStorage(Buffer.from(buffer), filename);
      console.log(`Generated image: ${imageUrl}`);

      // 7. Send via AiSensy
      await sendAiSensyMessage(subscriber.whatsapp_number, subscriber.name, imageUrl);
      console.log(`WhatsApp sent to ${subscriber.whatsapp_number}`);

      // 8. Mark as sent
      await supabase
        .from('dispatch_log')
        .update({
          status: 'sent',
          statement_image_path: imageUrl,
          sent_at: new Date().toISOString(),
          attempt_count: log.attempt_count + 1,
          last_error: null
        })
        .eq('id', log.id);

    } catch (err: any) {
      console.error(`Failed to process log ${log.id}:`, err);
      // Mark as failed
      await supabase
        .from('dispatch_log')
        .update({
          status: 'failed',
          attempt_count: log.attempt_count + 1,
          last_error: err.message
        })
        .eq('id', log.id);
    }
  }

  await browser.close();
  console.log("Dispatch processor finished.");
}

// If run directly with an argument 'run', execute immediately
if (process.argv[2] === 'run') {
  processPendingDispatches().then(() => process.exit(0));
} else {
  // Schedule to run every day at 9:00 AM
  console.log("Worker started. Cron scheduled for 09:00 AM daily.");
  cron.schedule('0 9 * * *', () => {
    console.log("Running scheduled dispatch job...");
    processPendingDispatches();
  });
}
