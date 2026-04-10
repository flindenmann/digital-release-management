"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  function: string | null;
  phone: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  _count: { projectUsers: number };
}

// ─── Benutzer erstellen / bearbeiten ──────────────────────────────────────────

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  user?: AdminUser | null;
}

function UserDialog({ open, onClose, user }: UserDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [functionVal, setFunctionVal] = useState("");
  const [phone, setPhone] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "");
      setUsername(user?.username ?? "");
      setFirstName(user?.firstName ?? "");
      setLastName(user?.lastName ?? "");
      setFunctionVal(user?.function ?? "");
      setPhone(user?.phone ?? "");
      setInitialPassword("");
      setError("");
    }
  }, [open, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users";
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        email,
        username,
        firstName,
        lastName,
        function: functionVal || null,
        phone: phone || null,
      };
      if (!isEdit) body.initialPassword = initialPassword;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Benutzer bearbeiten" : "Neuer Benutzer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Vorname *</Label>
              <Input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname *</Label>
              <Input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail *</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Benutzername *</Label>
            <Input
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="z.B. max.muster"
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="function">Funktion</Label>
              <Input
                id="function"
                value={functionVal}
                onChange={(e) => setFunctionVal(e.target.value)}
                placeholder="z.B. Release Manager"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 79 000 00 00"
                maxLength={50}
              />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="initialPassword">Initiales Passwort *</Label>
              <Input
                id="initialPassword"
                type="password"
                required
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Mind. 8 Zeichen"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Der Benutzer wird beim ersten Login aufgefordert, das Passwort zu ändern.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert…" : isEdit ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Passwort zurücksetzen ────────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

function ResetPasswordDialog({ open, onClose, user }: ResetPasswordDialogProps) {
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNewPassword("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
        </DialogHeader>

        {user && (
          <p className="text-sm text-muted-foreground">
            Neues temporäres Passwort für{" "}
            <span className="font-medium text-foreground">
              {user.firstName} {user.lastName}
            </span>{" "}
            festlegen. Der Benutzer wird beim nächsten Login aufgefordert, es zu ändern.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Neues Passwort *</Label>
            <Input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mind. 8 Zeichen"
              minLength={8}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert…" : "Passwort setzen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Fehler beim Laden der Benutzer.");
      return res.json();
    },
  });

  const users = data?.data ?? [];

  function openCreate() {
    setEditUser(null);
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setDialogOpen(true);
  }

  function openResetPassword(user: AdminUser) {
    setResetUser(user);
    setResetDialogOpen(true);
  }

  async function handleDelete(user: AdminUser) {
    if (user._count.projectUsers > 0) {
      setDeleteError(
        `"${user.firstName} ${user.lastName}" ist ${user._count.projectUsers} Release(s) zugewiesen und kann nicht gelöscht werden.`
      );
      return;
    }
    if (!confirm(`Benutzer "${user.firstName} ${user.lastName}" wirklich löschen?`)) return;

    setDeleteError("");
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error?.message ?? "Löschen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Benutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Globale Benutzerliste — Zugänge und Stammdaten verwalten
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Benutzer
        </Button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Benutzer.
        </div>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Benutzer erfasst.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ersten Benutzer erstellen
          </Button>
        </div>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="rounded-lg border divide-y">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3">
              {/* Avatar-Initialen */}
              <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground select-none">
                {user.firstName[0]}{user.lastName[0]}
              </div>

              {/* Name, Username, Funktion */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {user.firstName} {user.lastName}
                  </p>
                  {user.mustChangePassword && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Passwort ändern erforderlich
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                  {user.function && <span className="ml-2 text-muted-foreground/70">· {user.function}</span>}
                </p>
              </div>

              {/* Username + Release-Anzahl */}
              <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                <span className="text-xs font-mono text-muted-foreground">{user.username}</span>
                <span className="text-xs text-muted-foreground">
                  {user._count.projectUsers === 0
                    ? "Kein Release"
                    : `${user._count.projectUsers} Release${user._count.projectUsers !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Aktionen */}
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Passwort zurücksetzen"
                  onClick={() => openResetPassword(user)}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bearbeiten"
                  onClick={() => openEdit(user)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Löschen"
                  onClick={() => handleDelete(user)}
                  disabled={user._count.projectUsers > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        user={editUser}
      />
      <ResetPasswordDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        user={resetUser}
      />
    </main>
  );
}
