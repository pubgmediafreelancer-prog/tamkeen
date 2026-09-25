export const AGENT_NAME = "Weam Sabri";
export const AGENT_WHATSAPP_NUMBER = "905537045811";
export const AGENT_WHATSAPP_DISPLAY = "+90 553 704 5811";

export function agentWhatsAppLink(message: string): string {
  return `https://wa.me/${AGENT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
