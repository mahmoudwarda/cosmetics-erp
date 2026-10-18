"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    // ESC key closes any open details modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const openEditors = document.querySelectorAll<HTMLDetailsElement>("details[open]");
        openEditors.forEach((el) => {
          el.open = false;
        });
      }
    };

    // Clicking on backdrop (outside form) closes the modal (Light Dismiss)
    const handleMouseDown = (e: MouseEvent) => {
      const openEditors = document.querySelectorAll<HTMLDetailsElement>("details.editor[open], details.row-editor[open]");
      openEditors.forEach((details) => {
        const form = details.querySelector("form");
        if (!form) return;
        const rect = form.getBoundingClientRect();
        const isInForm =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        const summary = details.querySelector("summary");
        if (summary && summary.contains(e.target as Node)) {
          return;
        }

        if (!isInForm) {
          details.open = false;
        }
      });
    };

    // Form submission closes any parent details modal automatically
    const handleSubmit = (e: SubmitEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const form = target.closest("form");
      if (!form) return;
      const details = form.closest<HTMLDetailsElement>("details");
      if (details) {
        // Small delay so Next.js server action captures FormData before DOM node closes
        setTimeout(() => {
          details.open = false;
        }, 50);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("submit", handleSubmit as EventListener, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("submit", handleSubmit as EventListener, true);
    };
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
