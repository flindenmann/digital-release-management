# PROJECT_INSTRUCTIONS.md — Digital Release Management (dRM)

## 1. Projektziel

Die **dRM-App** ist eine Web-Applikation zur Planung und Verfolgung von Integrationseinführungen (Cut-over). Release Manager, Sachbearbeiter und Manager können gemeinsam Tasks, Meilensteine und Ressourcen verwalten – auch wenn Dutzende Personen gleichzeitig arbeiten.

---

## 2. Tech-Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR, File-based Routing, gute DX |
| UI | shadcn/ui + Tailwind CSS | Konsistente Komponenten, einfach erweiterbar |
| Backend/API | Next.js API Routes (Route Handlers) | Monorepo-freundlich; bei Bedarf auf FastAPI migrierbar |
| Datenbank | PostgreSQL via **Supabase** | Integriert: DB, Auth, Realtime, Storage, RLS |
| ORM | **Prisma** | Typsicher, automatische Migrationen, gute DX |
| Auth | **NextAuth.js** (Supabase Adapter) | Credentials heute, OIDC/AD-SSO später nachrüstbar |
| Realtime | Supabase Realtime (WebSockets) | Live-Updates für gleichzeitige User ohne Polling |
| File Storage | Supabase Storage | S3-kompatibel, für Attachments und Uploads |
| Hosting (gehostet) | Vercel (Frontend) + Supabase Cloud | Einfaches Deployment, gute Skalierung |
| Hosting (on-premise) | Docker Compose (Next.js + PostgreSQL + MinIO) | MinIO als S3-kompatibler Ersatz für Supabase Storage |

### Wichtige Packages

```
next, react, typescript
@prisma/client, prisma
next-auth
@supabase/supabase-js
@supabase/ssr
shadcn/ui, tailwindcss
zod                         # Input-Validierung
react-query / TanStack Query # Server-State-Management
date-fns                    # Datums-/Zeitoperationen
papaparse                   # CSV-Import/-Export
xlsx                        # Excel-Import/-Export
react-dropzone              # Datei-Upload UI
```

---

## 3. Datenmodell (Prisma Schema — Übersicht)

```
User
  id, email, username, firstName, lastName, function,
  phone, passwordHash, mustChangePassword (bool),
  createdAt, updatedAt

Team
  id, name, description

GlobalResource (zentrale Ressourcenliste)
  id, userId (FK User), teamId (FK Team),
  createdAt, updatedAt

GlobalApplication (zentrale Applikationsliste)
  id, name, prefix (z.B. "SYR"), description,
  createdAt, updatedAt

Release
  id, name, description, createdAt, updatedAt

ProjectUser (User-Rolle pro Release)
  id, releaseId, userId, role (RELEASE_MANAGER | SACHBEARBEITER | MANAGER)

ResourceSnapshot (Kopie bei Zuweisung zu Release)
  id, releaseId, globalResourceId,
  firstName, lastName, email, phone, function, teamName,
  createdAt

ApplicationSnapshot (Kopie bei Zuweisung zu Release)
  id, releaseId, globalApplicationId,
  name, prefix, description,
  createdAt

Task
  id, releaseId, applicationSnapshotId,
  key (z.B. "SYR-0042", auto-generiert),
  title, description,
  status (OPEN | PLANNED | DONE | ARCHIVED),
  startAt, endAt,
  createdBy, updatedBy, createdAt, updatedAt, version (int, für Optimistic Locking)

TaskAssignee
  id, taskId, resourceSnapshotId

TaskDependency
  id, predecessorId (FK Task), successorId (FK Task),
  type (FS | SS | FF)  -- Finish-Start, Start-Start, Finish-Finish

TaskAttachment
  id, taskId, name, url, storageKey (nullable), type (UPLOAD | LINK),
  createdAt

TaskComment
  id, taskId, userId, content, createdAt, updatedAt

Milestone
  id, releaseId, title, description,
  dateTime, isFixed (bool),
  status (OPEN | PLANNED | DONE | ARCHIVED),
  responsibleId (FK ResourceSnapshot),
  createdAt, updatedAt, version

MilestoneDependency
  id, milestoneId, taskId (nullable), predecessorMilestoneId (nullable),
  type (FS | SS | FF)

AuditLog
  id, entity (z.B. "Task"), entityId, action (CREATE|UPDATE|DELETE),
  userId, changedFields (JSON), oldValues (JSON), newValues (JSON),
  createdAt
```

### Snapshot-Prinzip

Sobald eine `GlobalApplication` oder ein `GlobalResource` einem Release zugewiesen wird, wird eine **Snapshot-Kopie** erstellt. Änderungen an der globalen Liste haben **keinen Einfluss** auf bestehende Releases — Nachvollziehbarkeit ist dadurch strukturell garantiert.

---

## 4. Rollen und Berechtigungen

| Aktion | Release Manager | Sachbearbeiter | Manager |
|---|---|---|---|
| Tasks anzeigen | ✅ alle | ✅ eigene (gefiltert) | ✅ alle (read-only) |
| Task erstellen/bearbeiten | ✅ | ✅ | ❌ |
| Task löschen | ✅ | ❌ | ❌ |
| Task archivieren | ✅ | ✅ | ❌ |
| Meilensteine anzeigen | ✅ | ✅ | ✅ |
| Meilensteine bearbeiten | ✅ | ❌ | ❌ |
| Releases verwalten | ✅ | ❌ | ❌ |
| Benutzer verwalten | ✅ | ❌ | ❌ |
| Globale Listen bearbeiten | ✅ | ❌ | ❌ |
| Import/Export | ✅ | ❌ | ❌ |

> Rollen sind **pro Release** vergeben (Tabelle `ProjectUser`). Eine Person kann in Release A Release Manager sein und in Release B Sachbearbeiter.

**Implementierung:** Berechtigungen werden auf zwei Ebenen durchgesetzt:
1. **API-Ebene:** Middleware prüft Rolle vor jedem Route Handler.
2. **DB-Ebene:** Supabase Row-Level-Security (RLS) als zweite Sicherheitsschicht.

---

## 5. Authentifizierung

### Aktuell: Credentials (Email + Passwort)

- Passwort wird mit **bcrypt** (min. 12 Rounds) gehasht.
- Neuer Benutzer erhält `mustChangePassword = true`.
- **Beim ersten Login** wird der User auf `/auth/set-password` weitergeleitet.
- Erst nach Passwort-Änderung wird die Session vollständig aktiviert.

### Später nachrüstbar: SSO / Azure AD

NextAuth.js unterstützt OIDC-Provider (Azure AD, Google Workspace) als Drop-in-Erweiterung. Die `ProjectUser`-Tabelle und das Session-Handling bleiben unverändert.

```typescript
// In auth.ts — später einfach Provider hinzufügen:
providers: [
  CredentialsProvider({ ... }),       // heute
  AzureADProvider({ ... }),           // später, kein Refactoring nötig
]
```

---

## 6. Parallelität und Echtzeit (20–50 gleichzeitige User)

### Optimistic Locking (Konflikt-Erkennung)

Jede `Task`- und `Milestone`-Row hat ein `version`-Feld (Integer).

```typescript
// Beim Speichern:
const updated = await prisma.task.updateMany({
  where: { id, version: currentVersion },   // schlägt fehl, wenn jemand anderes bereits gespeichert hat
  data:  { ...changes, version: { increment: 1 } },
});
if (updated.count === 0) {
  throw new ConflictError("Dieser Task wurde zwischenzeitlich geändert. Bitte Seite neu laden.");
}
```

Der Client zeigt dem Benutzer einen verständlichen Dialog mit der Option, die eigenen Änderungen zu verwerfen oder zu mergen.

### Realtime-Updates via Supabase

```typescript
// Im Frontend — Änderungen anderer werden live angezeigt:
supabase
  .channel(`release:${releaseId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'Task' }, (payload) => {
    queryClient.invalidateQueries(['tasks', releaseId]);
  })
  .subscribe();
```

Dies verhindert, dass Benutzer auf veralteten Daten arbeiten.

### On-Premise: Polling-Fallback

Wenn Supabase Realtime nicht verfügbar ist (Docker-Setup), fällt die App automatisch auf **Polling alle 10 Sekunden** zurück (konfigurierbar via Env-Variable `REALTIME_ENABLED=false`).

---

## 7. Error Handling

### Prinzipien

1. **Fail fast, fail visible:** Fehler werden nie still verschluckt.
2. **Benutzerfreundliche Meldungen:** Technische Details nur in Logs, nicht im UI.
3. **Retry für transiente Fehler:** Netzwerkfehler lösen automatisch bis zu 3 Retries aus.
4. **Zentrales Error Boundary:** Alle unerwarteten Fehler landen in einem globalen React Error Boundary.

### API-Fehlerformat (einheitlich)

```typescript
// Jede API-Antwort mit Fehler hat diese Struktur:
{
  "error": {
    "code":    "CONFLICT" | "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "INTERNAL",
    "message": "Benutzerfreundliche Beschreibung",
    "details": { ... }   // optional, nur in development
  }
}
```

### Middleware: Zentrales Error Handling

```typescript
// lib/api/withErrorHandling.ts
export function withErrorHandling(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      logger.error({ err, url: req.url, method: req.method });
      if (err instanceof ConflictError)    return res.status(409).json({ error: { code: "CONFLICT",    message: err.message } });
      if (err instanceof NotFoundError)    return res.status(404).json({ error: { code: "NOT_FOUND",   message: err.message } });
      if (err instanceof ForbiddenError)   return res.status(403).json({ error: { code: "FORBIDDEN",   message: err.message } });
      if (err instanceof ValidationError)  return res.status(400).json({ error: { code: "VALIDATION",  message: err.message, details: err.details } });
      return res.status(500).json({ error: { code: "INTERNAL", message: "Ein unerwarteter Fehler ist aufgetreten." } });
    }
  };
}
```

### Input-Validierung

Alle API-Eingaben werden mit **Zod** validiert, bevor sie die Business-Logik erreichen:

```typescript
const CreateTaskSchema = z.object({
  title:               z.string().min(1).max(200),
  applicationSnapshotId: z.string().uuid(),
  startAt:             z.coerce.date(),
  endAt:               z.coerce.date(),
  // ...
});
```

---

## 8. Nachvollziehbarkeit und Audit-Log

**Jede Schreib-Operation** auf Tasks, Meilensteinen, Releases und Benutzern erzeugt einen `AuditLog`-Eintrag:

```typescript
// lib/audit.ts
export async function logAudit(params: {
  entity:       string;
  entityId:     string;
  action:       "CREATE" | "UPDATE" | "DELETE";
  userId:       string;
  oldValues?:   Record<string, unknown>;
  newValues?:   Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      ...params,
      changedFields: params.oldValues
        ? Object.keys(params.newValues ?? {}).filter(k => params.oldValues![k] !== params.newValues![k])
        : [],
      createdAt: new Date(),
    }
  });
}
```

Der Audit-Log ist im UI als **History-Panel** auf jedem Task und Meilenstein einsehbar (wer hat wann was geändert).

### Zusätzlich: Snapshot-Prinzip

Wie unter Abschnitt 3 beschrieben, bleiben alle projektbezogenen Daten (Ressourcen, Applikationen) als Snapshots erhalten, auch wenn globale Listen geändert werden.

---

## 9. Backup-Strategie

### Supabase (gehostet)

- Supabase Cloud erstellt **tägliche automatische Backups** (PITR auf Pro-Plan).
- Export via `pg_dump` kann zusätzlich per Cron-Job (z.B. GitHub Actions) täglich auf S3 gesichert werden.

### On-Premise (Docker)

```yaml
# docker-compose.yml — Backup-Service
backup:
  image: postgres:16
  environment:
    PGPASSWORD: ${DB_PASSWORD}
  volumes:
    - ./backups:/backups
  entrypoint: |
    sh -c "pg_dump -h db -U ${DB_USER} ${DB_NAME} | gzip > /backups/drm_$(date +%Y%m%d_%H%M%S).sql.gz"
```

- Backups werden täglich um 02:00 Uhr via Cron ausgelöst.
- Aufbewahrung: **30 Tage**, ältere Backups werden automatisch gelöscht.
- Dateisystem-Attachments (MinIO) werden per `mc mirror` täglich gespiegelt.

---

## 10. Code-Qualität und Wiederverwendbarkeit

### Projektstruktur

```
/app
  /(auth)/                  # Login, Passwort setzen
  /(app)/
    dashboard/              # Startseite / Übersicht
    releases/[id]/
      tasks/                # Taskliste (Hauptseite)
      milestones/           # Meilenstein-Übersicht
      resources/            # Ressourcensicht
    admin/
      users/                # Benutzerverwaltung
      applications/         # Globale Applikationsliste
      resources/            # Globale Ressourcenliste
/components
  ui/                       # shadcn/ui Basis-Komponenten
  tasks/                    # TaskCard, TaskForm, TaskFilters, ...
  milestones/               # MilestoneTimeline, MilestoneForm, ...
  resources/                # ResourceTimeline, ...
  shared/                   # AuditLogPanel, AttachmentList, StatusBadge, ...
/lib
  api/                      # withErrorHandling, withAuth, withRole
  audit.ts                  # logAudit()
  errors.ts                 # ConflictError, NotFoundError, ...
  prisma.ts                 # Singleton Prisma Client
  supabase.ts               # Supabase Client (SSR-kompatibel)
  permissions.ts            # can(user, action, resource)
/prisma
  schema.prisma
  migrations/
/hooks
  useRelease.ts, useTasks.ts, useMilestones.ts, ...
/types
  index.ts                  # Alle zentralen TypeScript-Typen
```

### Wiederverwendbarkeit — Regeln

1. **Kein Copy-Paste:** Jede Logik existiert genau einmal. Business-Logik liegt in `/lib`, nicht in Komponenten oder Route Handlers.
2. **Permissions zentral:** Berechtigungsprüfungen immer via `can(user, action, resource)` in `/lib/permissions.ts` — niemals inline im JSX.
3. **Komponenten props-driven:** Alle UI-Komponenten erhalten ihre Daten via Props, kein direkter API-Aufruf in Leaf-Komponenten.
4. **Hooks für Server-State:** `useTasks()`, `useMilestones()` etc. via TanStack Query — kein manuelles `useState` + `useEffect` für API-Calls.
5. **Zod-Schemas doppelt nutzen:** Schema für API-Validierung und für TypeScript-Typen ableiten (`z.infer<typeof CreateTaskSchema>`).

### Naming Conventions

- Dateien: `kebab-case.ts` für Utilities, `PascalCase.tsx` für Komponenten
- API Routes: REST-Konvention (`GET /api/releases/:id/tasks`, `POST /api/releases/:id/tasks`)
- Datenbankfelder: `camelCase` in Prisma, `snake_case` in PostgreSQL (automatisch via Prisma)
- Status-Enums: immer `SCREAMING_SNAKE_CASE` (`OPEN`, `PLANNED`, `DONE`, `ARCHIVED`)

---

## 11. Wichtige Business-Regeln (für Implementierung)

1. **Task-Schlüssel** werden automatisch generiert: `{applicationPrefix}-{4-stellige laufende Nummer pro Applikation}`. Beispiel: `SYR-0042`. Der Prefix kommt aus dem `ApplicationSnapshot.prefix`.
2. **Archivierte Tasks/Meilensteine** werden in Listen ausgeblendet und ihre Abhängigkeiten aufgelöst. Ein gesonderter "Archiv"-Filter macht sie wieder sichtbar.
3. **Fixe Meilensteine:** Wenn eine Abhängigkeit eine Verschiebung erfordern würde, wird **keine** automatische Verschiebung durchgeführt. Stattdessen:
   - Warnung in der Meilenstein-Detailansicht.
   - Dauerhaftes Warning-Badge in der Meilenstein-Übersicht (Timeline) bis der Konflikt manuell aufgelöst wird.
4. **Variable Meilensteine** verschieben sich automatisch, wenn ein Vorgänger-Task sein End-Datum ändert.
5. **Taskliste als Startseite:** Sachbearbeiter sehen beim Login automatisch die gefilterte Taskliste (nur eigene Tasks, Status ≠ ARCHIVED).
6. **Ressourcen-Snapshot:** Beim Hinzufügen einer `GlobalResource` zu einem Release wird der aktuelle Stand als `ResourceSnapshot` kopiert. Spätere Änderungen an der globalen Ressource betreffen das Release **nicht**.
7. **Passwort-Flow:** `mustChangePassword = true` → nach Login Redirect auf `/auth/set-password` → erst nach Passwort-Änderung ist der User voll aktiv.

---

## 12. Umgebungsvariablen (`.env.local`)

```env
# Datenbank
DATABASE_URL="postgresql://user:pass@localhost:5432/drm"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Supabase (gehostet) oder leer lassen bei on-premise
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Realtime (false bei on-premise ohne Supabase)
REALTIME_ENABLED="true"

# Storage (on-premise: MinIO-Endpoint)
STORAGE_ENDPOINT="https://xxx.supabase.co/storage/v1"
STORAGE_BUCKET="drm-attachments"

# Logging
LOG_LEVEL="info"   # debug | info | warn | error
```

---

## 13. Entwicklungs-Workflow

```bash
# Setup
npm install
npx prisma migrate dev

# Development
npm run dev

# Prisma Studio (DB-Browser)
npx prisma studio

# Type-Check
npm run typecheck

# Lint
npm run lint

# Tests
npm run test
```

---

## 15. Docker-Entwicklungsumgebung

Die lokale Entwicklung läuft vollständig in Docker. Supabase Cloud wird **nicht** für die lokale Entwicklung benötigt – alle Dienste laufen lokal.

### Dienste (docker-compose.dev.yml)

```yaml
services:

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules       # node_modules nicht überschreiben
      - /app/.next              # .next-Cache nicht überschreiben
    environment:
      - DATABASE_URL=postgresql://drm:drm@db:5432/drm
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=dev-secret-change-in-production
      - REALTIME_ENABLED=false
      - STORAGE_ENDPOINT=http://minio:9000
      - STORAGE_BUCKET=drm-attachments
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"             # für Prisma Studio direkt erreichbar
    environment:
      POSTGRES_USER: drm
      POSTGRES_PASSWORD: drm
      POSTGRES_DB: drm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U drm"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"             # S3 API
      - "9001:9001"             # MinIO Console (http://localhost:9001)
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 3

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://minio:9000 minioadmin minioadmin;
        mc mb --ignore-existing local/drm-attachments;
        mc anonymous set download local/drm-attachments;
      "

volumes:
  postgres_data:
  minio_data:
```

### Dockerfile.dev

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

### Wichtige Befehle

```bash
# Erstmaliges Setup
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev
docker compose -f docker-compose.dev.yml exec app npx prisma db seed

# Tägliche Arbeit
docker compose -f docker-compose.dev.yml up -d        # starten
docker compose -f docker-compose.dev.yml down          # stoppen
docker compose -f docker-compose.dev.yml logs -f app   # Logs

# Prisma
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev    # neue Migration
docker compose -f docker-compose.dev.yml exec app npx prisma studio         # DB-Browser (Port 5555)

# Shell im App-Container
docker compose -f docker-compose.dev.yml exec app sh
```

### Portübersicht (lokal)

| Dienst | URL | Zweck |
|---|---|---|
| Next.js App | http://localhost:3000 | App |
| PostgreSQL | localhost:5432 | Prisma Studio, DB-Tools |
| MinIO S3 API | http://localhost:9000 | File Storage |
| MinIO Console | http://localhost:9001 | Storage-Browser |
| Prisma Studio | http://localhost:5555 | DB-Browser (manuell starten) |

### Hinweise für Claude Code

- `DATABASE_URL` zeigt immer auf den `db`-Service (`db:5432`), nicht auf `localhost`.
- File-Uploads gehen an MinIO (`STORAGE_ENDPOINT=http://minio:9000`). Der Supabase Storage-Client wird mit einem S3-kompatiblen Client (z.B. `@aws-sdk/client-s3`) ersetzt, wenn `REALTIME_ENABLED=false`.
- Hot-Reload funktioniert via Volume-Mount (`.:/app`). Änderungen am Code werden sofort wirksam ohne Container-Neustart.
- Prisma Migrations immer via `exec app npx prisma migrate dev` ausführen – nie direkt im Host, da die DB nur im Docker-Netzwerk erreichbar ist (ausser über Port 5432).
- Bei Schema-Änderungen zuerst `prisma migrate dev`, dann den `app`-Container neu starten: `docker compose -f docker-compose.dev.yml restart app`.

---

## 14. Offene Punkte / Roadmap

| Prio | Feature | Notiz |
|---|---|---|
| V1 | Alle Anforderungen aus Abschnitt 3–11 | Pflichtumfang |
| V1 | Dashboard mit Fortschrittsübersicht | Einfach: Zähler pro Status |
| V1 | Passwort-Setzen-Flow bei erstem Login | Sicherheits-Minimum |
| V1 | Audit-Log als History-Panel | Nachvollziehbarkeit |
| V1.1 | E-Mail-Benachrichtigungen (Zuweisung, Statusänderung) | Nach Go-Live |
| V1.1 | SSO / Azure AD via OIDC | NextAuth.js Provider, kein Refactoring |
| V2 | Gantt-Chart-Ansicht | Aufwändig, nicht für V1 |
| V2 | Erweiterte Reporting-Funktionen | PDF-Export, etc. |
