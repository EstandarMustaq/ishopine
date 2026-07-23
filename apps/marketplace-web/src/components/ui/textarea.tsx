import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-[14px] text-[var(--brand-charcoal)] transition-colors outline-none placeholder:text-zinc-400 focus-visible:border-[var(--ds-brand)] focus-visible:ring-2 focus-visible:ring-[var(--ds-brand)]/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  )
}

export { Textarea }
