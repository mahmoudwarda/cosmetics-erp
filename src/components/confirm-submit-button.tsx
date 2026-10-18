"use client";

import { ReactNode } from "react";

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  title,
  ariaLabel,
  children,
}: {
  confirmMessage: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
