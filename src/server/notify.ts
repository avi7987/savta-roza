import "server-only";

/** Read a setting from the Cloudflare environment (secrets/vars) or, in development, process.env. */
export async function setting(name: string): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const v = (env as unknown as Record<string, unknown>)[name];
    if (typeof v === "string" && v) return v;
  } catch {}
  return process.env[name] || undefined;
}

/**
 * Email the site owner through Resend (https://resend.com). Needs the secrets
 * RESEND_API_KEY and ALERT_EMAIL. Without a domain of your own, Resend only delivers
 * to the address the Resend account was opened with, which is exactly the owner.
 */
export async function emailOwner(subject: string, html: string) {
  const key = await setting("RESEND_API_KEY");
  const to = await setting("ALERT_EMAIL");
  if (!key || !to) {
    console.warn(`[alert] not sent (RESEND_API_KEY / ALERT_EMAIL missing): ${subject}`);
    return false;
  }
  const endpoint = (await setting("ALERT_ENDPOINT")) ?? "https://api.resend.com/emails";
  const from = (await setting("ALERT_FROM")) ?? "Savta Roza site <onboarding@resend.dev>";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) console.warn(`[alert] email failed: ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.warn("[alert] email failed", e);
    return false;
  }
}
