"use client";

import { ReactNode } from "react";

const inputClass =
  "w-full rounded-xl border border-(--color-line) bg-white px-3.5 py-2.5 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-teal) placeholder:text-(--color-ink)/35";

export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-(--color-ink)/80">
        {label}
        {required && <span className="text-(--color-gold)"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function SelectInput({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select {...props} className={inputClass}>
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
