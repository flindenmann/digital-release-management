"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, KeyRound, ChevronsUpDown, Check, Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface GlobalResource {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    function: string | null;
    phone: string | null;
    mustChangePassword: boolean;
  } | null;
  team: { id: string; name: string } | null;
  _count: { resourceSnapshots: number };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(resources: GlobalResource[]) {
  const csv = Papa.unparse(
    resources
      .filter((r) => r.user)
      .map((r) => ({
        firstName: r.user!.firstName,
        lastName: r.user!.lastName,
        email: r.user!.email,
        username: r.user!.username,
        function: r.user!.function ?? "",
        phone: r.user!.phone ?? "",
        teamName: r.team?.name ?? "",
      })),
    { header: true }
  );
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ressourcen.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  const csv = Papa.unparse(
    [{ firstName: "Max", lastName: "Muster", email: "max.muster@example.com", username: "max.muster", initialPassword: "Passwort123!", function: "Entwickler", phone: "+41 79 000 00 00", teamName: "Team A" }],
    { header: true }
  );
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ressourcen_vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportResult {
  index: number;
  success: boolean;
  error?: string;
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function ImportDialog({ open, onClose }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  useEffect(() => {
    if (open) {
      setRows([]);
      setParseError("");
      setResults(null);
    }
  }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setResults(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError("CSV-Datei konnte nicht gelesen werden: " + result.errors[0].message);
          return;
        }
        if (result.data.length === 0) {
          setParseError("Die Datei enthält keine Datenzeilen.");
          return;
        }
        setRows(result.data);
      },
    });
    e.target.value = "";
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resources/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
    } finally {
      setLoading(false);
    }
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const errorCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ressourcen importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">CSV-Vorlage</p>
              <p className="text-xs text-muted-foreground">Spalten: firstName, lastName, email, username, initialPassword, function, phone, teamName</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Vorlage
            </Button>
          </div>

          <p className="text-xs text-muted-foreground rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
            Alle Ressourcen erhalten <strong>mustChangePassword = true</strong> und werden beim ersten Login aufgefordert, das Passwort zu ändern.
          </p>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              CSV-Datei auswählen
            </Button>
          </div>

          {parseError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{parseError}</p>
          )}

          {rows.length > 0 && !results && (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{rows.length} Zeile{rows.length !== 1 ? "n" : ""}</span> erkannt — bereit zum Importieren
              </p>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                {rows.slice(0, 5).map((r, i) => (
                  <p key={i} className="truncate">{r.firstName} {r.lastName} — {r.email}</p>
                ))}
                {rows.length > 5 && <p>…und {rows.length - 5} weitere</p>}
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {successCount} erfolgreich
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {errorCount} Fehler
                  </span>
                )}
              </div>
              {results.filter((r) => !r.success).length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
                  {results.filter((r) => !r.success).map((r) => (
                    <p key={r.index} className="text-xs text-destructive">
                      Zeile {r.index + 2}: {r.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              {results ? "Schliessen" : "Abbrechen"}
            </Button>
            {!results && (
              <Button onClick={handleImport} disabled={rows.length === 0 || loading}>
                {loading ? "Wird importiert…" : `${rows.length} Zeile${rows.length !== 1 ? "n" : ""} importieren`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TeamSelect ───────────────────────────────────────────────────────────────

interface TeamSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function TeamSelect({ value, onChange, disabled = false }: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const teams = data?.data ?? [];
  const filtered = teams.filter((t: { id: string; name: string }) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const showCreate =
    search.trim() !== "" &&
    !teams.some((t: { id: string; name: string }) => t.name.toLowerCase() === search.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function select(name: string) {
    onChange(name);
    setSearch("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span>{value || "Team auswählen oder neu erfassen…"}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3">
            <input
              autoFocus
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Suchen oder neu erfassen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const match = filtered[0];
                  if (match && !showCreate) select(match.name);
                  else if (search.trim()) select(search.trim());
                }
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map((t: { id: string; name: string }) => (
              <button
                key={t.id}
                type="button"
                onClick={() => select(t.name)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Check className={cn("h-4 w-4 shrink-0", value === t.name ? "opacity-100" : "opacity-0")} />
                {t.name}
              </button>
            ))}

            {showCreate && (
              <button
                type="button"
                onClick={() => select(search.trim())}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-muted-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>
                  Neues Team erstellen:{" "}
                  <span className="font-medium text-foreground">{search.trim()}</span>
                </span>
              </button>
            )}

            {filtered.length === 0 && !showCreate && (
              <p className="py-4 text-center text-sm text-muted-foreground">Keine Teams vorhanden.</p>
            )}
          </div>

          {value && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={clear}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                Auswahl zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ressource erstellen ──────────────────────────────────────────────────────

interface CreateResourceDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateResourceDialog({ open, onClose }: CreateResourceDialogProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [func, setFunc] = useState("");
  const [phone, setPhone] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFirstName(""); setLastName(""); setEmail(""); setUsername("");
      setInitialPassword(""); setFunc(""); setPhone(""); setTeamName("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, username, initialPassword,
          function: func || null,
          phone: phone || null,
          teamName: teamName || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Ressource</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cr-firstname">Vorname *</Label>
              <Input id="cr-firstname" required value={firstName}
                onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-lastname">Nachname *</Label>
              <Input id="cr-lastname" required value={lastName}
                onChange={(e) => setLastName(e.target.value)} maxLength={100} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cr-email">E-Mail *</Label>
            <Input id="cr-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cr-username">Benutzername *</Label>
              <Input id="cr-username" required value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z.B. max.muster" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-password">Initiales Passwort *</Label>
              <Input id="cr-password" type="password" required value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Mind. 8 Zeichen" minLength={8} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cr-function">Funktion</Label>
              <Input id="cr-function" value={func}
                onChange={(e) => setFunc(e.target.value)} placeholder="Optional" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-phone">Telefon</Label>
              <Input id="cr-phone" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="Optional" maxLength={50} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <TeamSelect value={teamName} onChange={setTeamName} />
          </div>

          <p className="text-xs text-muted-foreground">
            Die Ressource wird beim ersten Login aufgefordert, das Passwort zu ändern.
          </p>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird erstellt…" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ressource bearbeiten ─────────────────────────────────────────────────────

interface EditResourceDialogProps {
  open: boolean;
  onClose: () => void;
  resource: GlobalResource | null;
}

function EditResourceDialog({ open, onClose, resource }: EditResourceDialogProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [username,  setUsername]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [func,      setFunc]      = useState("");
  const [teamName,  setTeamName]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const hasUser = !!resource?.user;

  useEffect(() => {
    if (open && resource) {
      setFirstName(resource.user?.firstName ?? "");
      setLastName(resource.user?.lastName ?? "");
      setEmail(resource.user?.email ?? "");
      setUsername(resource.user?.username ?? "");
      setPhone(resource.user?.phone ?? "");
      setFunc(resource.user?.function ?? "");
      setTeamName(resource.team?.name ?? "");
      setError("");
    }
  }, [open, resource]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resource) return;
    setError("");
    setLoading(true);
    try {
      const body = hasUser
        ? { firstName, lastName, email, username, phone: phone || null, function: func || null, teamName: teamName || null }
        : { teamName: teamName || null };

      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ressource bearbeiten</DialogTitle>
        </DialogHeader>

        {!hasUser && (
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Kein Benutzer verknüpft — persönliche Daten können nicht bearbeitet werden. Nur die Team-Zuweisung ist änderbar.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="er-firstname">Vorname {hasUser && "*"}</Label>
              <Input id="er-firstname" required={hasUser} disabled={!hasUser}
                value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-lastname">Nachname {hasUser && "*"}</Label>
              <Input id="er-lastname" required={hasUser} disabled={!hasUser}
                value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="er-email">E-Mail {hasUser && "*"}</Label>
            <Input id="er-email" type="email" required={hasUser} disabled={!hasUser}
              value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="er-username">Benutzername {hasUser && "*"}</Label>
            <Input id="er-username" required={hasUser} disabled={!hasUser}
              value={username} onChange={(e) => setUsername(e.target.value)} maxLength={50} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="er-function">Funktion</Label>
              <Input id="er-function" disabled={!hasUser} value={func}
                onChange={(e) => setFunc(e.target.value)} placeholder="Optional" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-phone">Telefon</Label>
              <Input id="er-phone" disabled={!hasUser} value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="Optional" maxLength={50} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <TeamSelect value={teamName} onChange={setTeamName} />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert…" : "Speichern"}
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
  resource: GlobalResource | null;
}

function ResetPasswordDialog({ open, onClose, resource }: ResetPasswordDialogProps) {
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setNewPassword(""); setError(""); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resource) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
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

        {resource?.user && (
          <p className="text-sm text-muted-foreground">
            Neues temporäres Passwort für{" "}
            <span className="font-medium text-foreground">
              {resource.user.firstName} {resource.user.lastName}
            </span>{" "}
            festlegen. Die Ressource wird beim nächsten Login aufgefordert, es zu ändern.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-2">
            <Label htmlFor="rp-password">Neues Passwort *</Label>
            <Input id="rp-password" type="password" required value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mind. 8 Zeichen" minLength={8} />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
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

export default function AdminResourcesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editResource, setEditResource] = useState<GlobalResource | null>(null);
  const [resetResource, setResetResource] = useState<GlobalResource | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: GlobalResource[] }>({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources");
      if (!res.ok) throw new Error("Fehler beim Laden der Ressourcen.");
      return res.json();
    },
  });

  const resources = data?.data ?? [];

  async function handleDelete(resource: GlobalResource) {
    if (resource._count.resourceSnapshots > 0) {
      const name = resource.user
        ? `${resource.user.firstName} ${resource.user.lastName}`
        : "Diese Ressource";
      setDeleteError(
        `"${name}" ist ${resource._count.resourceSnapshots} Release(s) zugewiesen und kann nicht gelöscht werden.`
      );
      return;
    }
    const name = resource.user
      ? `${resource.user.firstName} ${resource.user.lastName}`
      : "diese Ressource";
    if (!confirm(`Ressource "${name}" und den verknüpften Benutzer wirklich löschen?`)) return;

    setDeleteError("");
    const res = await fetch(`/api/admin/resources/${resource.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error?.message ?? "Löschen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressourcenverwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ressourcen verwalten — jede Ressource ist automatisch ein Benutzer
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCsv(resources)} disabled={resources.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Ressource
          </Button>
        </div>
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
          Fehler beim Laden der Ressourcen.
        </div>
      )}

      {!isLoading && !isError && resources.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Ressourcen erfasst.</p>
          <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Ressource erstellen
          </Button>
        </div>
      )}

      {!isLoading && !isError && resources.length > 0 && (
        <div className="rounded-lg border divide-y">
          {resources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-4 px-4 py-3">
              <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground select-none">
                {resource.user
                  ? `${resource.user.firstName[0]}${resource.user.lastName[0]}`
                  : "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">
                    {resource.user
                      ? `${resource.user.firstName} ${resource.user.lastName}`
                      : "(Kein Benutzer)"}
                  </p>
                  {resource.team && (
                    <Badge variant="secondary" className="text-xs">
                      {resource.team.name}
                    </Badge>
                  )}
                  {resource.user?.mustChangePassword && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Passwort ändern erforderlich
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {resource.user?.email}
                  {resource.user?.function && (
                    <span className="ml-2 text-muted-foreground/70">· {resource.user.function}</span>
                  )}
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                {resource.user?.username && (
                  <span className="text-xs font-mono text-muted-foreground">{resource.user.username}</span>
                )}
                {resource.user?.phone && (
                  <span className="text-xs text-muted-foreground">{resource.user.phone}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {resource._count.resourceSnapshots === 0
                    ? "Kein Release"
                    : `${resource._count.resourceSnapshots} Release${resource._count.resourceSnapshots !== 1 ? "s" : ""}`}
                </span>
              </div>

              <div className="flex gap-1 shrink-0">
                {resource.user && (
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    title="Passwort zurücksetzen"
                    onClick={() => setResetResource(resource)}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  title="Bearbeiten"
                  onClick={() => setEditResource(resource)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Löschen"
                  onClick={() => handleDelete(resource)}
                  disabled={resource._count.resourceSnapshots > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateResourceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <EditResourceDialog
        open={editResource !== null}
        onClose={() => setEditResource(null)}
        resource={editResource}
      />
      <ResetPasswordDialog
        open={resetResource !== null}
        onClose={() => setResetResource(null)}
        resource={resetResource}
      />
    </main>
  );
}
