import { AGENT_NAME, agentWhatsAppLink } from "@/lib/contact";

/**
 * Direct contact with Stardom University's authorized admissions agent —
 * separate from the AI chat, for students who want a human immediately.
 */
export function WhatsAppButton() {
  return (
    <a
      href={agentWhatsAppLink("Hi, I'm interested in studying at Stardom University.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contact ${AGENT_NAME}, Stardom University's authorized admissions agent, on WhatsApp`}
      title={`Contact ${AGENT_NAME} — Authorized Admissions Agent — on WhatsApp`}
      className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-(--shadow-lg) transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C9.377 3 4 8.373 4 14.997c0 2.362.675 4.567 1.845 6.432L4 29l7.744-1.813a12.95 12.95 0 0 0 4.26.72c6.627 0 12.004-5.373 12.004-11.997C28.008 8.373 22.63 3 16.004 3Zm7.03 17.018c-.293.826-1.457 1.51-2.386 1.71-.635.135-1.463.243-4.253-.914-3.566-1.478-5.86-5.09-6.038-5.328-.177-.238-1.446-1.926-1.446-3.674s.913-2.606 1.238-2.964c.324-.358.708-.448.944-.448.236 0 .472.002.678.012.218.01.51-.083.797.608.293.706 1 2.454 1.088 2.632.088.178.147.386.03.624-.118.238-.177.386-.354.593-.177.208-.372.464-.531.623-.177.178-.362.372-.156.73.207.357.916 1.513 1.967 2.451 1.352 1.206 2.492 1.58 2.85 1.757.359.178.567.148.777-.089.207-.238.884-1.03 1.12-1.386.236-.357.472-.297.797-.178.324.119 2.06.972 2.414 1.149.354.178.59.267.678.416.088.148.088.86-.206 1.686Z" />
      </svg>
    </a>
  );
}
