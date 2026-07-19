"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Role, User } from "@/lib/types";

const roles: Role[] = ["CUSTOMER", "OPERATOR", "ADMIN"];

export default function PainelUsuariosPage() {
  return (
    <AuthGate adminOnly>
      <UsersContent />
    </AuthGate>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<User[]>("/users");
      setUsers(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar usuários",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateRole(id: string, role: Role) {
    try {
      await api(`/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast.success("Papel atualizado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar papel",
      );
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await api(`/users/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      toast.success(isActive ? "Usuário ativado" : "Usuário desativado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar usuário",
      );
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Usuários</h1>
      <p className="mt-1 text-sm text-taupe">
        Gestão de papéis e acesso (somente admin).
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[12px] border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-beige text-taupe">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-taupe">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(v) => updateRole(user.id, v as Role)}
                    >
                      <SelectTrigger className="h-9 w-[140px] rounded-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {user.isActive === false ? "Inativo" : "Ativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleActive(user.id, user.isActive === false)
                      }
                    >
                      {user.isActive === false ? "Ativar" : "Desativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
