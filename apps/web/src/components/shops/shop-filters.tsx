"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOP_TYPES } from "@/lib/mozambique";

export function ShopFilters({
  initialQ,
  initialType,
}: {
  initialQ?: string;
  initialType?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ ?? "");
  const [type, setType] = useState(initialType ?? "all");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (type && type !== "all") qs.set("type", type);
    const query = qs.toString();
    router.push(query ? `/lojas?${query}` : "/lojas");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 grid gap-4 sm:grid-cols-[1fr_220px_auto]"
    >
      <Field>
        <FieldLabel htmlFor="q">Pesquisar loja</FieldLabel>
        <Input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou distrito…"
        />
      </Field>
      <Field>
        <FieldLabel>Tipo de loja</FieldLabel>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {SHOP_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
