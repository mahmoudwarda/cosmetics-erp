"use client";

import { Printer } from "lucide-react";

export function PrintButton({
  label = "طباعة",
  thermal = false,
}: {
  label?: string;
  thermal?: boolean;
}) {
  return (
    <button
      className="secondary print-hide inline-flex items-center gap-1.5"
      type="button"
      onClick={() => {
        if (thermal) document.documentElement.classList.add("thermal-print");
        window.print();
        window.setTimeout(() => document.documentElement.classList.remove("thermal-print"), 1000);
      }}
    >
      <Printer size={15} />
      <span>{label}</span>
    </button>
  );
}
