import fs from 'fs';

let content = fs.readFileSync('src/routes/dispatch.tsx', 'utf-8');

const replacement = `
  const sendOne = async (sub: any) => {
    // 1. Construct the WhatsApp text message
    let msg = \`*ABC Chits (P) Ltd.*\n(A ROSCA Institution)\n\n\`;
    msg += \`Dear *$\{sub.subscriber.name}*,\n\`;
    msg += \`Kindly note your chit amount for *$\{formatMonth(month)}* and pay before Auction Date.\n\n\`;
    
    sub.rows.forEach((r: any) => {
      msg += \`🔹 *Group:* $\{r.group_code}\n\`;
      msg += \`   *Auction Date:* $\{r.auction_day}\n\`;
      msg += \`   *Chit Value:* $\{formatINR(r.chit_value)}\n\`;
      msg += \`   *Prized:* $\{r.prized ? 'Yes' : 'No'}\n\`;
      msg += \`   *Due Amount:* ₹$\{formatINR(r.amount_due)}\n\n\`;
    });
    
    msg += \`*Total Amount Due:* ₹$\{formatINR(sub.total)}\n\n\`;
    msg += \`Please pay promptly.\`;

    // 2. Open WhatsApp Web
    let phone = sub.subscriber.whatsapp_number.replace(/\\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const url = \`https://api.whatsapp.com/send?phone=$\{phone}&text=$\{encodeURIComponent(msg)}\`;
    window.open(url, '_blank');

    // 3. Mark as sent in DB
    const payload = {
      subscriber_id: sub.subscriber.id,
      month,
      whatsapp_number: sub.subscriber.whatsapp_number,
      status: "sent",
      sent_at: new Date().toISOString(),
      attempt_count: (sub.log?.attempt_count ?? 0) + 1,
      last_error: null as string | null,
    };
    
    if (sub.log) {
      const { error } = await db.from("dispatch_log").update(payload).eq("id", sub.log.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await db.from("dispatch_log").insert(payload);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["dispatch-summary", month] });
  };
\`;

content = content.replace(/const sendOne = async \(sub: any\) => \{[\s\S]*?qc\.invalidateQueries\(\{ queryKey: \["dispatch-summary", month\] \}\);\n  \};/, replacement.trim());

fs.writeFileSync('src/routes/dispatch.tsx', content);
