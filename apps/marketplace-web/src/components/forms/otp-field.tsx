"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export function OtpField({
  id,
  label = "Código",
  description,
  value,
  onChange,
  maxLength = 6,
  className,
  autoFocus,
}: {
  id?: string;
  label?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: 6 | 8;
  className?: string;
  autoFocus?: boolean;
}) {
  const slots = Array.from({ length: maxLength }, (_, i) => i);

  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputOTP
        id={id}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        containerClassName="w-full justify-between gap-1.5 sm:justify-start sm:gap-2"
      >
        <InputOTPGroup className="gap-1.5 border-0 bg-transparent sm:gap-2">
          {slots.map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className={cn(
                "size-10 rounded-xl border border-[var(--brand-border)] text-[15px] font-semibold shadow-none first:rounded-xl first:border-l last:rounded-xl sm:size-11",
                "data-[active=true]:border-[var(--ds-brand)] data-[active=true]:ring-2 data-[active=true]:ring-[var(--ds-brand)]/25",
              )}
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}
