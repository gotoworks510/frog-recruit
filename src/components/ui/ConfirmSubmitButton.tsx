"use client";

import type { ReactNode } from "react";

interface ConfirmSubmitButtonProps {
  children: ReactNode;
  /** Confirmation prompt shown before the parent form is allowed to submit. */
  message: string;
  className?: string;
}

/**
 * Submit button that asks for confirmation before letting its parent
 * `<form action={serverAction}>` submit. Used for destructive admin actions
 * (e.g. deleting an employer account). Cancelling the prompt aborts the submit.
 */
export function ConfirmSubmitButton({
  children,
  message,
  className,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
