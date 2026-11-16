import "server-only";
import { store } from "./store";

/*
  One door to Cloudflare Workers AI for everything "smart" on the site.

  On Cloudflare the AI binding is used. In development, if CF_AI_ACCOUNT is set, the same models are
  called over Cloudflare's REST API (the token is added by the environment, never kept in code).

  The free plan gives a daily allowance. To keep photo dating and family questions working every
  day, background work (reading letters, transcribing, finding facts) takes at most a share of it,
  counted per day; whatever is left waits for tomorrow. Nothing here can create a bill.
*/

export const MODELS = {
  text: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  vision: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  speech: "@cf/openai/whisper-large-v3-turbo",
  embed: "@cf/baai/bge-m3",
  /** grandma's answers: a larger model that writes more natural, warmer Hebrew and Russian */
  voice: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
} as const;

type Ai = { run(model: string, input: unknown): Promise<unknown> };

export async function binding(): Promise<Ai | undefined> {
  // development with CF_AI_ACCOUNT: straight to the REST API (the local proxy for the binding
  // needs a connection to Cloudflare that is not always available)
  if (process.env.CF_AI_ACCOUNT) return rest(process.env.CF_AI_ACCOUNT);
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as unknown as { AI?: Ai }).AI;
    if (ai) return ai;
  } catch {}
  return undefined;
}

/** the REST API, with the credential supplied by the environment */
function rest(account: string): Ai {
  return {
    async run(model, input) {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN ?? "from-environment"}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const j = (await r.json().catch(() => ({}))) as { result?: unknown; errors?: { message?: string }[] };
      if (!r.ok) throw new Error(`AI ${r.status}: ${j.errors?.[0]?.message ?? ""}`);
      return j.result;
    },
  };
}

export async function aiAvailable() {
  return !!(await binding());
}

/** how many calls of each kind may run in one day (UTC), so the free allowance is shared sensibly */
// questions use the larger model, which takes more of the free allowance per answer: fewer a day
const DAILY: Record<Budget, number> = { background: 120, speech: 25, ask: 80, embed: 600 };
export type Budget = "background" | "speech" | "ask" | "embed";

const today = () => new Date().toISOString().slice(0, 10);

export async function budgetLeft(kind: Budget) {
  const used = Number((await store.getMeta(`ai-${kind}-${today()}`)) ?? 0);
  return DAILY[kind] - used;
}

/** a call that counts against the day's share; null when the share (or the allowance) is used up */
export async function runAi<T = unknown>(kind: Budget, model: string, input: unknown): Promise<T | null> {
  const ai = await binding();
  if (!ai) return null;
  const key = `ai-${kind}-${today()}`;
  const used = Number((await store.getMeta(key)) ?? 0);
  if (used >= DAILY[kind]) return null;
  await store.setMeta(key, String(used + 1));
  try {
    return (await ai.run(model, input)) as T;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    // the account's own daily allowance is spent: stop everyone for today
    if (/4006|daily|neurons|quota|429/i.test(msg)) await store.setMeta(key, String(DAILY[kind]));
    console.warn("[ai]", kind, msg);
    return null;
  }
}

/** a chat answer as text */
export async function chat(kind: Budget, messages: { role: "system" | "user" | "assistant"; content: unknown }[], opts: { maxTokens?: number; temperature?: number; model?: string } = {}) {
  const input = { messages, max_tokens: opts.maxTokens ?? 900, temperature: opts.temperature ?? 0.2 };
  let res = await runAi<{ response?: unknown }>(kind, opts.model ?? MODELS.text, input);
  // the chosen model is not available (and the day's share is not used up): the usual one answers
  if (!res && opts.model && opts.model !== MODELS.text && (await budgetLeft(kind)) > 0) res = await runAi<{ response?: unknown }>(kind, MODELS.text, input);
  if (!res) return null;
  return typeof res.response === "string" ? res.response : JSON.stringify(res.response ?? "");
}

/** the first JSON value in a model's answer, or null (the answer is untrusted text) */
export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export const base64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
