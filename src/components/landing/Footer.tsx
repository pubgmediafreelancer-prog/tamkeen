export function Footer() {
  return (
    <footer className="border-t border-(--color-line) bg-(--color-paper) py-10">
      <div className="mx-auto max-w-6xl px-6 text-sm text-(--color-ink)/55">
        <p>
          This site is an independent <strong>Stardom University Admissions Assistant</strong>, operated to help
          prospective students explore Stardom University programs and the application process. It is not Stardom
          University itself. Official information:{" "}
          <a className="underline" href="https://stardomuniversity.edu.eu/" target="_blank" rel="noreferrer">
            stardomuniversity.edu.eu
          </a>
          .
        </p>
        <p className="mt-3">
          Admissions: admission@stardomuniversity.edu.eu · &copy; {new Date().getFullYear()} Stardom University
          Admissions Assistant
        </p>
      </div>
    </footer>
  );
}
