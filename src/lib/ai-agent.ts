import { TOOLS, runTool } from "@/lib/ai-tools";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const KEY_API = "chitflow_groq_api_key";
const DEFAULT_KEY = "";

export const getApiKey = () => localStorage.getItem(KEY_API) || DEFAULT_KEY;
export const setApiKey = (k: string) => localStorage.setItem(KEY_API, k);

const SYSTEM_PROMPT = `You are ChitSync AI, an operations assistant embedded inside a chit fund management SaaS.
You have direct read/write access to the company database and a scheduler via tools.

You can:
- Manage subscribers (list/get/create/update/delete) and chit groups
- Manage subscriptions, view monthly dues
- Send a dispatch (mock receipt/reminder) for any subscriber+month
- Link two subscribers in family relationships (e.g. son linked to father)
- Schedule monthly recurring reminders that include linked subscribers' dues
- Run due reminders on demand and inspect the action log

Important behaviour:
- Use tools whenever an action requires data; never make up ids, codes, or amounts.
- If the user gives a name, first call list_subscribers to resolve to an id.
- For "send X reminder to father along with son's receipts every month", first resolve both subscribers,
  link them with link_subscribers, then call schedule_recurring_reminder with target=father and include=[son_id].
- After taking actions, summarise concisely in plain Indian English. Format money with Indian commas (1,00,000).
- Be decisive. If the user's intent is clear, just do it and report the result. Don't ask for confirmation
  unless the action would be destructive (delete_subscriber hard:true, delete_group).
- Keep replies short. Bullet points are fine.`;

type ChatMsg =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: any[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type AgentEvent =
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; result: any }
  | { type: "assistant"; text: string }
  | { type: "error"; message: string };

const groqTools = TOOLS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

export async function runAgent(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  onEvent: (e: AgentEvent) => void,
  maxSteps = 8,
): Promise<string> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  let finalText = "";
  for (let step = 0; step < maxSteps; step++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages,
        tools: groqTools,
        tool_choice: "auto",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      onEvent({ type: "error", message: `Groq HTTP ${res.status}: ${errBody.slice(0, 200)}` });
      throw new Error(`Groq error ${res.status}`);
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error("Empty response from model");

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls } as ChatMsg);
      for (const call of msg.tool_calls) {
        let args: any = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        onEvent({ type: "tool_call", name: call.function.name, args });
        const result = await runTool(call.function.name, args);
        onEvent({ type: "tool_result", name: call.function.name, result });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result).slice(0, 6000),
        } as ChatMsg);
      }
      continue;
    }

    finalText = msg.content || "";
    onEvent({ type: "assistant", text: finalText });
    return finalText;
  }
  const truncated = "Reached the maximum number of steps without a final answer. Try a more specific request.";
  onEvent({ type: "assistant", text: truncated });
  return truncated;
}
