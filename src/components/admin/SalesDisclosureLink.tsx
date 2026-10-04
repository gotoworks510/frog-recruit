"use client";

import type { ReactNode } from "react";

/** Open the target before navigating so keyboard and pointer users reach the form. */
export function SalesDisclosureLink({ target, className, children }: {
  target: string;
  className?: string;
  children: ReactNode;
}) {
  return <a href={`#${target}`} className={className} onClick={() => {
    const section = document.getElementById(target);
    if (section instanceof HTMLDetailsElement) {
      section.open = true;
      section.querySelector("summary")?.focus();
    }
  }}>{children}</a>;
}
