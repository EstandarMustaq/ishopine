import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      data-1p-ignore
      data-lpignore="true"
      data-form-type="other"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-input bg-white px-3.5 py-2 text-[14px] text-[var(--brand-charcoal)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-zinc-400 focus-visible:border-[var(--ds-brand)] focus-visible:ring-2 focus-visible:ring-[var(--ds-brand)]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
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

export { Input }
