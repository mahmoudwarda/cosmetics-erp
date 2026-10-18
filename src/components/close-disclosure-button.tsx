"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function CloseDisclosureButton({ title }: { title?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const disclosure = ref.current?.closest("details");
    if (!disclosure) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && disclosure.open) {
        disclosure.open = false;
      }
    };

    const handleBackdropClick = (e: MouseEvent) => {
      // When clicking the backdrop (which is the details element outside the modal form)
      if (disclosure.open && e.target === disclosure) {
        disclosure.open = false;
      }
    };

    const handleFormSubmit = () => {
      setTimeout(() => {
        if (disclosure.open) disclosure.open = false;
      }, 50);
    };

    window.addEventListener("keydown", handleKeyDown);
    disclosure.addEventListener("click", handleBackdropClick);
    disclosure.addEventListener("submit", handleFormSubmit);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      disclosure.removeEventListener("click", handleBackdropClick);
      disclosure.removeEventListener("submit", handleFormSubmit);
    };
  }, []);

  return (
    <div ref={ref} className="modal-header">
      {title ? (
        <div className="modal-title-wrap">
          <h4 className="modal-title">{title}</h4>
        </div>
      ) : (
        <span />
      )}
      <button
        type="button"
        className="close-disclosure"
        aria-label="إغلاق النافذة"
        title="إغلاق (Esc)"
        onClick={(event) => {
          const disclosure = event.currentTarget.closest("details");
          if (disclosure) disclosure.open = false;
        }}
      >
        <X size={15} />
        <span>إغلاق</span>
      </button>
    </div>
  );
}
