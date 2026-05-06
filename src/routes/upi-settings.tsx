import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getUpiSettings, saveUpiSettings, subscribeDemoChanges, type UpiSettings } from "@/lib/demo-data";
import { QrCode, Upload, ImageIcon, ShieldAlert, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/upi-settings")({
  component: () => (
    <ProtectedLayout>
      <UpiSettingsPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "UPI Settings — Panasuna Chits" }] }),
});

function UpiSettingsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || import.meta.env.DEV;
  const [upi, setUpi] = useState<UpiSettings>(() => getUpiSettings());
  const [upiId, setUpiId] = useState(upi.upiId ?? "");
  const [payeeName, setPayeeName] = useState(upi.payeeName ?? "Panasuna Chits");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeDemoChanges(() => {
      const fresh = getUpiSettings();
      setUpi(fresh);
      setUpiId(fresh.upiId ?? "");
      setPayeeName(fresh.payeeName ?? "Panasuna Chits");
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-xl font-semibold">Admins only</h2>
        <p className="mt-2 text-sm text-muted-foreground">UPI Settings can only be accessed by admin users.</p>
      </div>
    );
  }

  const enableStatic = () => {
    if (upi.mode === "dynamic") {
      if (!confirm("Enabling Static Scanner will disable the Dynamic UPI QR. Continue?")) return;
    }
    saveUpiSettings({ mode: "static" });
    toast.success("Static Scanner mode enabled");
  };

  const enableDynamic = () => {
    if (!upiId.trim()) {
      toast.error("Enter a UPI ID first");
      return;
    }
    if (!/^[\w.\-]+@[\w.\-]+$/.test(upiId.trim())) {
      toast.error("Invalid UPI ID format. Expected: name@bankhandle");
      return;
    }
    if (upi.mode === "static") {
      if (!confirm("Enabling Dynamic UPI QR will disable the Static Scanner. Continue?")) return;
    }
    saveUpiSettings({ mode: "dynamic", upiId: upiId.trim(), payeeName: payeeName.trim() || "Panasuna Chits" });
    toast.success("Dynamic UPI QR mode enabled");
  };

  const onUploadImage = (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Only PNG/JPG images allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveUpiSettings({ mode: "static", staticImage: dataUrl });
      toast.success("Static QR image saved");
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    saveUpiSettings({ mode: "none", staticImage: null });
    toast.success("Static QR image removed");
  };

  const clearUpiId = () => {
    saveUpiSettings({ mode: "none", upiId: null, payeeName: null });
    setUpiId("");
    toast.success("UPI ID cleared");
  };

  const statusLabel =
    upi.mode === "static" ? "Static Scanner Enabled" : upi.mode === "dynamic" ? "Dynamic UPI QR Enabled" : "No Payment QR Active";

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-bold">Payment & QR Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how payment QR codes appear in subscriber reminders. Only one method can be active at a time.
        </p>
      </header>

      {/* Status indicator */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          upi.mode === "none" ? "bg-muted/50 text-muted-foreground" : "bg-emerald-50 text-emerald-900 border-emerald-200"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full ${
            upi.mode === "none" ? "bg-muted-foreground/40" : "bg-emerald-500"
          }`}
        />
        <div className="text-sm font-medium">Current Active Mode: {statusLabel}</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mode A — Static */}
        <div
          className={`rounded-xl border p-5 ${
            upi.mode === "static" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[var(--navy)]" />
                <h2 className="text-lg font-semibold">Static Scanner / QR Image</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Upload your bank or UPI QR code image. The same image is printed at the bottom of every reminder. Subscribers
                enter the amount manually when scanning.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                upi.mode === "static" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {upi.mode === "static" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {upi.mode === "static" ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {upi.staticImage ? (
              <div className="rounded-lg border bg-white p-3">
                <img
                  src={upi.staticImage}
                  alt="Static QR"
                  className="mx-auto h-48 w-48 object-contain"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">Preview (max 300×300 in reminder)</p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <ImageIcon className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2">No image uploaded</p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadImage(f);
                e.target.value = "";
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {upi.staticImage ? "Replace Image" : "Upload Image"}
              </button>
              {upi.mode !== "static" && upi.staticImage && (
                <button
                  type="button"
                  onClick={enableStatic}
                  className="inline-flex items-center rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm text-white hover:opacity-90"
                >
                  Enable Static Scanner
                </button>
              )}
              {upi.staticImage && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Image
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mode B — Dynamic */}
        <div
          className={`rounded-xl border p-5 ${
            upi.mode === "dynamic" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[var(--navy)]" />
                <h2 className="text-lg font-semibold">Dynamic UPI QR (Per Subscriber)</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Enter your UPI ID. A unique QR code is auto-generated for each subscriber's reminder with their exact due
                amount pre-filled. They scan and pay without entering any amount.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                upi.mode === "dynamic" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {upi.mode === "dynamic" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {upi.mode === "dynamic" ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">UPI ID</span>
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="panasunachits@ybl"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Payee Name</span>
              <input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Panasuna Chits"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enableDynamic}
                className="inline-flex items-center rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm text-white hover:opacity-90"
              >
                Verify & Save
              </button>
              {upi.upiId && (
                <button
                  type="button"
                  onClick={clearUpiId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear UPI ID
                </button>
              )}
            </div>

            {upi.mode === "dynamic" && upi.upiId && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
                Saved UPI ID: <span className="font-mono font-medium">{upi.upiId}</span>. Dynamic QR codes will now be
                generated per subscriber.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
