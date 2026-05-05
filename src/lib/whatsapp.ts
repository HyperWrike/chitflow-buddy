import { formatINR, formatMonth, formatDateDMY } from "@/lib/format";

export type WhatsAppMode = "browser" | "twilio-demo" | "twilio-proxy";

export type DispatchSummaryRow = {
  auction_day: number;
  group_code: string;
  name_on_chit: string;
  prized: boolean;
  chit_value: number;
  amount_due: number;
};

export type DispatchSubscriber = {
  id: string;
  name: string;
  access_code: string;
  whatsapp_number: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  pincode: string | null;
};

export function getWhatsAppMode(): WhatsAppMode {
  const raw = (import.meta.env.VITE_WHATSAPP_MODE ?? import.meta.env.VITE_WA_MODE ?? "browser")
    .toString()
    .toLowerCase();

  if (raw === "twilio" || raw === "twilio-demo") return "twilio-demo";
  if (raw === "twilio-proxy" || raw === "proxy") return "twilio-proxy";
  return "browser";
}

export function getWhatsAppModeLabel(): string {
  const mode = getWhatsAppMode();
  if (mode === "twilio-demo") return "Twilio demo";
  if (mode === "twilio-proxy") return "Twilio proxy";
  return "Browser handoff";
}

export function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length >= 12) return digits.slice(0, 12);
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildDispatchMessage(
  subscriber: DispatchSubscriber,
  month: string,
  rows: DispatchSummaryRow[],
): string {
  const lines = [
    `*Panasuna Chits (P) Ltd.*`,
    `(A ROSCA Institution)`,
    "",
    `Dear *${subscriber.name}*`,
    `Access Code: *${subscriber.access_code}*`,
    `Statement Month: *${formatMonth(month)}*`,
    `WhatsApp: *${subscriber.whatsapp_number}*`,
    "",
    `Please review your chit dues and pay before the auction date.`,
    "",
  ];

  rows.forEach((row) => {
    lines.push(
      `• Group: *${row.group_code}*`,
      `  Auction Date: ${row.auction_day}`,
      `  Prized: ${row.prized ? "Yes" : "No"}`,
      `  Chit Value: ${formatINR(row.chit_value)}`,
      `  Due Amount: ${formatINR(row.amount_due)}`,
      "",
    );
  });

  const total = rows.reduce((sum, row) => sum + row.amount_due, 0);

  lines.push(
    `Total Due: *${formatINR(total)}*`,
    `Address: ${[subscriber.address_line1, subscriber.address_line2, subscriber.city, subscriber.pincode].filter(Boolean).join(", ")}`,
    `Generated on: ${formatDateDMY(new Date())}`,
  );

  return lines.join("\n");
}

export function buildWhatsAppLaunchUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}

export function buildTwilioProxyPayload(params: {
  subscriber: DispatchSubscriber;
  month: string;
  rows: DispatchSummaryRow[];
  message: string;
}) {
  return {
    transport: "twilio",
    to: normalizeWhatsAppNumber(params.subscriber.whatsapp_number),
    subscriber: params.subscriber,
    month: params.month,
    rows: params.rows,
    message: params.message,
    meta: {
      accessCode: params.subscriber.access_code,
      monthLabel: formatMonth(params.month),
      sentAt: new Date().toISOString(),
    },
  };
}

export async function sendWhatsAppMessage(params: {
  subscriber: DispatchSubscriber;
  month: string;
  rows: DispatchSummaryRow[];
}) {
  const message = buildDispatchMessage(params.subscriber, params.month, params.rows);
  const mode = getWhatsAppMode();
  const proxyUrl = import.meta.env.VITE_WHATSAPP_PROXY_URL;

  if (mode === "twilio-proxy" && proxyUrl) {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildTwilioProxyPayload({ ...params, message })),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp proxy failed with status ${response.status}`);
    }

    return {
      mode,
      transport: "proxy" as const,
      message,
      payload: await response.json().catch(() => null),
    };
  }

  const launchUrl = buildWhatsAppLaunchUrl(params.subscriber.whatsapp_number, message);
  if (typeof window !== "undefined") {
    const opened = window.open(launchUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(launchUrl);
    }
  }

  return {
    mode,
    transport: mode === "twilio-demo" ? "demo" : "browser",
    message,
    launchUrl,
  };
}
