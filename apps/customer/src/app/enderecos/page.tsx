"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PageHeader,
  EmptyState,
  Card,
  Button as DsButton,
  Input,
  LoadingState,
} from "@ishopine/ui";
import { apiFetch } from "@/lib/api";

type Address = {
  id: string;
  label?: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
};

export default function CustomerAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    street: "",
    number: "",
    district: "",
    city: "",
    state: "Maputo",
    zipCode: "",
    label: "Principal",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Address[]>("/addresses");
      setAddresses(Array.isArray(data) ? data : []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/addresses", {
        method: "POST",
        body: JSON.stringify({ ...form, isDefault: addresses.length === 0 }),
      });
      toast.success("Endereço guardado");
      setForm({
        street: "",
        number: "",
        district: "",
        city: "",
        state: "Maputo",
        zipCode: "",
        label: "Principal",
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao guardar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Endereços"
        description="Moradas de entrega em Moçambique."
      />
      {loading ? (
        <LoadingState label="A carregar endereços" variant="skeleton" />
      ) : addresses.length === 0 ? (
        <EmptyState
          title="Nenhum endereço"
          description="Adicione uma morada para acelerar o checkout."
        />
      ) : (
        <ul className="mb-8 space-y-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card>
                <p className="text-[14px] font-medium">
                  {a.label || "Endereço"}
                  {a.isDefault ? " · predefinido" : ""}
                </p>
                <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">
                  {a.street} {a.number}, {a.district}, {a.city} — {a.state}{" "}
                  {a.zipCode}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <h2 className="text-[16px] font-semibold">Novo endereço</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createAddress}>
          {(
            [
              ["label", "Etiqueta"],
              ["street", "Rua"],
              ["number", "Número"],
              ["district", "Bairro"],
              ["city", "Cidade"],
              ["state", "Província"],
              ["zipCode", "Código postal"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-[12px] font-medium">
              {label}
              <Input
                className="mt-1"
                required={key !== "label"}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <DsButton type="submit">Guardar endereço</DsButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
