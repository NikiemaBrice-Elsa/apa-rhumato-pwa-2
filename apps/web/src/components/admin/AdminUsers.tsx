"use client";

import { useEffect, useState } from "react";
import { canAdminSetUserStatus, type UserRole, type UserStatus } from "@apa/domain";
import { Button } from "@/components/ui/Button";

interface AdminUserRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

const ROLE_LABELS_FR: Record<UserRole, string> = {
  patient: "Patient",
  professional: "Professionnel",
  admin: "Administrateur",
};

const STATUS_LABELS_FR: Record<UserStatus, string> = {
  active: "Actif",
  suspended: "Suspendu",
  deleted: "Supprimé",
};

/** §42 « gestion utilisateurs ». Le statut `deleted` est terminal (§45 :
 * suppression de compte demandée par l'utilisateur lui-même) — jamais
 * proposé comme action ici, voir `canAdminSetUserStatus`. */
export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload(q?: string) {
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users ?? []);
      setError(null);
    } else {
      setError(data.message ?? "Une erreur est survenue.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function updateUser(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Une erreur est survenue.");
    }
    await reload(query);
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          reload(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, email)…"
          className="flex-1 rounded-lg border border-primary-300 px-3 py-2"
        />
        <Button type="submit" className="w-auto">
          Rechercher
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-primary-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary-50 text-primary-700">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-primary-100">
                <td className="px-3 py-2">
                  {u.first_name} {u.last_name ?? ""}
                </td>
                <td className="px-3 py-2 text-primary-500">{u.email ?? u.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={busyId === u.id}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="rounded border border-primary-300 px-2 py-1"
                  >
                    {(Object.keys(ROLE_LABELS_FR) as UserRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS_FR[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{STATUS_LABELS_FR[u.status]}</td>
                <td className="px-3 py-2">
                  {(["active", "suspended"] as UserStatus[])
                    .filter((target) => target !== u.status && canAdminSetUserStatus(u.status, target))
                    .map((target) => (
                      <Button
                        key={target}
                        type="button"
                        variant="secondary"
                        className="w-auto px-3 py-1 text-xs"
                        disabled={busyId === u.id}
                        onClick={() => updateUser(u.id, { status: target })}
                      >
                        {target === "suspended" ? "Suspendre" : "Réactiver"}
                      </Button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-4 text-sm text-primary-500">Aucun utilisateur.</p>}
      </div>
    </div>
  );
}
