import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getUpiSettings, subscribeDemoChanges, type UpiSettings } from "@/lib/demo-data";

type Props = {
  amount: number;          // exact total due
  subscriberName: string;  // for transaction note
  reference?: string;      // group code or chit number
};

export function buildUpiDeepLink(opts: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${params.toString()}`;
}

export function UpiBlock({ amount, subscriberName, reference }: Props) {
  const [upi, setUpi] = useState<UpiSettings>(() => getUpiSettings());
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    return subscribeDemoChanges(() => setUpi(getUpiSettings()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (upi.mode === "dynamic" && upi.upiId) {
      const note = `${subscriberName}${reference ? "-" + reference : ""}`.replace(/[^A-Za-z0-9 \-]/g, "").slice(0, 40);
      const deepLink = buildUpiDeepLink({
        upiId: upi.upiId,
        payeeName: upi.payeeName || "Panasuna Chits",
        amount: Math.max(0, Math.round(amount)),
        note,
      });
      QRCode.toDataURL(deepLink, { margin: 1, width: 220, errorCorrectionLevel: "M" })
        .then((url) => { if (!cancelled) setQrDataUrl(url); })
        .catch(() => { if (!cancelled) setQrDataUrl(null); });
    } else {
      setQrDataUrl(null);
    }
    return () => { cancelled = true; };
  }, [upi.mode, upi.upiId, upi.payeeName, amount, subscriberName, reference]);

  if (upi.mode === "none") return null;

  const wrapper: React.CSSProperties = {
    textAlign: "center",
    padding: "10px 0",
    borderTop: "1px solid #0f2744",
    marginTop: 4,
    background: "#fff",
  };
  const heading: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "#0f2744",
    marginBottom: 6,
  };

  if (upi.mode === "static" && upi.staticImage) {
    return (
      <div style={wrapper}>
        <div style={heading}>For UPI, use the scanner below</div>
        <img src={upi.staticImage} alt="Scan to pay" style={{ width: 140, height: 140, objectFit: "contain", display: "inline-block" }} />
      </div>
    );
  }

  if (upi.mode === "dynamic" && qrDataUrl) {
    return (
      <div style={wrapper}>
        <div style={heading}>For UPI, use the scanner below</div>
        <img src={qrDataUrl} alt="UPI QR" style={{ width: 140, height: 140, display: "inline-block" }} />
        <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
          Amount pre-filled: ₹{Math.max(0, Math.round(amount)).toLocaleString("en-IN")}
        </div>
      </div>
    );
  }

  return null;
}
