import "server-only";

/**
 * n8n is the automation layer (notifications, follow-ups, CRM sync). This
 * app never encodes that business logic itself — it just fires typed
 * webhook events and lets n8n workflows react.
 *
 * Configure:
 *  - N8N_WEBHOOK_URL_LEAD_CREATED
 *  - N8N_WEBHOOK_URL_HOT_LEAD
 *  - N8N_WEBHOOK_URL_APPLICATION_EVENT
 * Any event whose URL isn't configured is a silent no-op (logged once),
 * so the app degrades gracefully without n8n connected.
 */
type N8nEvent = "lead_created" | "hot_lead" | "application_event";

const ENV_KEY: Record<N8nEvent, string> = {
  lead_created: "N8N_WEBHOOK_URL_LEAD_CREATED",
  hot_lead: "N8N_WEBHOOK_URL_HOT_LEAD",
  application_event: "N8N_WEBHOOK_URL_APPLICATION_EVENT",
};

export async function notifyN8n(event: N8nEvent, payload: Record<string, unknown>) {
  const url = process.env[ENV_KEY[event]];
  if (!url) {
    console.warn(`[n8n] ${ENV_KEY[event]} not configured — skipping ${event} webhook.`);
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), ...payload }),
    });
  } catch (err) {
    console.error(`[n8n] Failed to notify ${event}:`, err);
  }
}
