"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--ds-surface)",
          "--normal-text": "var(--ds-text)",
          "--normal-border": "var(--ds-border-subdued)",
          "--border-radius": "var(--ds-radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
