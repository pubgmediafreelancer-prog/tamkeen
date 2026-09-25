import { AGENT_NAME, AGENT_WHATSAPP_DISPLAY, agentWhatsAppLink } from "@/lib/contact";

export function Footer() {
  return (
    <footer className="border-t border-(--color-line) bg-(--color-paper) py-10">
      <div className="mx-auto max-w-6xl px-6 text-sm text-(--color-ink)/55">
        <p>
          This site is an independent <strong>Stardom University Admissions Assistant</strong>, represented by{" "}
          {AGENT_NAME}, an authorized admissions agent helping prospective students explore Stardom University
          programs and the application process. It is not Stardom University itself. Official information:{" "}
          <a className="underline" href="https://stardomuniversity.edu.eu/" target="_blank" rel="noreferrer">
            stardomuniversity.edu.eu
          </a>
          .
        </p>
        <p className="mt-3">
          Admissions:{" "}
          <a
            className="underline"
            href={agentWhatsAppLink("Hi, I'm interested in studying at Stardom University.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp {AGENT_WHATSAPP_DISPLAY}
          </a>{" "}
          · &copy; {new Date().getFullYear()} Stardom University Admissions Assistant
        </p>
      </div>
    </footer>
  );
}
