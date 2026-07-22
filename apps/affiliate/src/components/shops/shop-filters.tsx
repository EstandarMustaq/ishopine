"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOP_TYPES } from "@/lib/mozambique";

export function ShopFilters({
  initialType,
}: {
  initialQ?: string;
  initialType?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType ?? "all");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (type && type !== "all") qs.set("type", type);
    const query = qs.toString();
    router.push(query ? `/lojas?${query}` : "/lojas");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field className="sm:max-w-xs">
        <FieldLabel>tipo de loja</FieldLabel>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full rounded-full">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">todos os tipos</SelectItem>
            {SHOP_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" className="rounded-full">
        filtrar
      </Button>
    </form>
  );
}
