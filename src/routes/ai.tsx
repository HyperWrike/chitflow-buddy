import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { runAgent, getApiKey, setApiKey, type AgentEvent } from "@/lib/ai-agent";
import {
  getReminders,
  getActionLog,
  runDueReminders,
  deleteReminder,
  getLinks,
} from "@/lib/ai-scheduler";
import { Bot, Send, Sparkles, KeyRound, Eye, EyeOff, Trash2, Play, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai")({
  component: AIPage,
  head: () => ({ meta: [{ title: "AI Assistant — Panasuna Chits" }] }),
});

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  events?: AgentEvent[];
};

const SUGGESTIONS = [
  "Show me the top 10 subscribers and how many groups each is enrolled in",
  "Find subscriber by name 'Ravi' and list their dues for this month",
  'Link "Suresh" as the father of "Priya" and schedule a monthly statement on the 1st that includes Priya\'s dues in his receipt',
  "Run any due reminders now and show me what was sent",
  "Show all dispatches sent this month and how many failed",
];

function AIPage() {
  return (
    <ProtectedLayout>
      <AI />
    </ProtectedLayout>
  );
}

function AI() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text:
        "Namaste. I'm your operations assistant. I can read and write the database, link customers, and schedule monthly reminders. Try one of the suggestions below or just tell me what you need.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyValue, setKeyValue] = useState(getApiKey());
  const [reminders, setReminders] = useState(getReminders());
  const [actionLog, setActionLog] = useState(getActionLog());
  const [links, setLinks] = useState(getLinks());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    runDueReminders().then((r) => {
      if (r.fired > 0) {
        toast.success(`Auto-fired ${r.fired} due reminder(s)`);
        refreshSidebars();
      }
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const refreshSidebars = () => {
    setReminders(getReminders());
    setActionLog(getActionLog());
    setLinks(getLinks());
  };

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    const aiMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", text: "", events: [] };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setBusy(true);

    const history = messages
      .filter((m) => m.text)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      await runAgent(history, trimmed, (ev) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiMsg.id) return m;
            const events = [...(m.events ?? []), ev];
            const text = ev.type === "assistant" ? ev.text : m.text;
            return { ...m, text, events };
          }),
        );
        if (ev.type === "tool_result") refreshSidebars();
      });
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? { ...m, text: `Error: ${(e as Error).message}` } : m)),
      );
    } finally {
      setBusy(false);
      refreshSidebars();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="flex flex-col overflow-hidden border" style={{ height: "calc(100vh - 7.5rem)" }}>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--navy)]">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <div>
            <div className="font-display text-sm">ChitSync AI</div>
            <div className="text-[11px] text-muted-foreground">Operates the database directly · Groq · llama-3.3-70b</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {reminders.filter((r) => r.active).length} active reminder(s)
            </Badge>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <Message key={m.id} msg={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5 animate-pulse" />
              Thinking and calling tools…
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => send(s)}
                className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Tell me what to do… e.g. 'create subscriber Anil 9876500099 then enroll in group GRP-001'"
              disabled={busy}
            />
            <Button onClick={() => send(input)} disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> Groq API Key
          </div>
          <div className="flex gap-1">
            <Input
              type={showKey ? "text" : "password"}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              className="text-xs"
            />
            <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => {
              setApiKey(keyValue.trim());
              toast.success("API key saved");
            }}
          >
            Save key
          </Button>
        </Card>

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Reminders
            </Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await runDueReminders(true);
                toast.success(`Fired ${r.fired} of ${r.checked} reminder(s)`);
                refreshSidebars();
              }}
            >
              <Play className="mr-1 h-3 w-3" /> Run all
            </Button>
          </div>
          {reminders.length === 0 ? (
            <div className="text-xs text-muted-foreground">No reminders scheduled. Ask the AI to create one.</div>
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => (
                <div key={r.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Day {r.day_of_month} · next {new Date(r.next_run).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </div>
                      {r.include_subscriber_ids.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          + {r.include_subscriber_ids.length} linked
                        </div>
                      )}
                    </div>
                    <button
                      title="Delete"
                      onClick={() => {
                        deleteReminder(r.id);
                        refreshSidebars();
                        toast.success("Reminder deleted");
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-3">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Family Links ({links.length})
          </Label>
          {links.length === 0 ? (
            <div className="text-xs text-muted-foreground">None yet.</div>
          ) : (
            <div className="space-y-1 text-[11px]">
              {links.slice(0, 5).map((l, i) => (
                <div key={i} className="font-mono text-muted-foreground">
                  {l.child_id.slice(0, 8)} → {l.parent_id.slice(0, 8)}
                </div>
              ))}
              {links.length > 5 && <div className="text-muted-foreground">+ {links.length - 5} more</div>}
            </div>
          )}
        </Card>

        <Card className="p-3">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Actions
          </Label>
          {actionLog.length === 0 ? (
            <div className="text-xs text-muted-foreground">No actions yet.</div>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              {actionLog.slice(0, 8).map((a) => (
                <div key={a.id} className="border-l-2 border-[var(--gold)] pl-2">
                  <div className="font-mono text-[9px] uppercase text-muted-foreground">{a.kind}</div>
                  <div className="text-foreground/90">{a.summary}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Message({ msg }: { msg: ChatMsg }) {
  const [open, setOpen] = useState(false);
  const hasTools = (msg.events ?? []).some((e) => e.type === "tool_call");
  return (
    <div className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
          msg.role === "user" ? "bg-[var(--gold)] text-[var(--navy)]" : "bg-[var(--navy)] text-[var(--gold)]"
        }`}
      >
        {msg.role === "user" ? "You" : "AI"}
      </div>
      <div className="max-w-[78%] space-y-1.5">
        <div
          className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
            msg.role === "user" ? "bg-[var(--navy)] text-white" : "bg-muted"
          }`}
        >
          {msg.text || (msg.role === "assistant" && hasTools ? "…" : "")}
        </div>
        {hasTools && (
          <div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Wrench className="h-3 w-3" />
              {msg.events!.filter((e) => e.type === "tool_call").length} tool call(s)
            </button>
            {open && (
              <div className="mt-1 space-y-1 rounded border bg-background/50 p-2 text-[10px]">
                {msg.events!.map((e, i) => {
                  if (e.type === "tool_call")
                    return (
                      <div key={i} className="font-mono">
                        <span className="text-[var(--gold)]">→ {e.name}</span>(
                        <span className="text-muted-foreground">{JSON.stringify(e.args).slice(0, 120)}</span>)
                      </div>
                    );
                  if (e.type === "tool_result")
                    return (
                      <div key={i} className="font-mono text-muted-foreground">
                        ← {e.name}: {JSON.stringify(e.result).slice(0, 140)}
                      </div>
                    );
                  if (e.type === "error")
                    return (
                      <div key={i} className="font-mono text-destructive">
                        ! {e.message}
                      </div>
                    );
                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
