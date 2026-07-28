export type EmailMessage = { to: string; subject: string; html: string; text?: string; replyTo?: string };

export async function sendEmail(message: EmailMessage) {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  if (provider === "console") {
    console.info("[H2OBOOK email demo]", { ...message, html: message.html.slice(0, 180) });
    return { id: `console_${crypto.randomUUID()}`, provider, accepted: true };
  }
  if (provider === "webhook") {
    if (!process.env.EMAIL_WEBHOOK_URL) throw new Error("EMAIL_WEBHOOK_URL_NOT_CONFIGURED");
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_KEY ?? ""}` }, body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }) });
    if (!response.ok) throw new Error(`EMAIL_WEBHOOK_FAILED_${response.status}`);
    return { id: response.headers.get("x-message-id") ?? crypto.randomUUID(), provider, accepted: true };
  }
  if (provider === "resend") {
    if (!process.env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY_NOT_CONFIGURED");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_KEY}` }, body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }) });
    if (!response.ok) throw new Error(`EMAIL_SEND_FAILED_${response.status}`);
    return { ...(await response.json() as { id: string }), provider, accepted: true };
  }
  throw new Error(`UNSUPPORTED_EMAIL_PROVIDER_${provider}`);
}
