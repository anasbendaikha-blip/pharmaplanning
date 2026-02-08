# Systeme de Notifications PharmaPlanning

## Vue d'ensemble

Systeme complet de notifications multi-canal (email via Resend + in-app via Supabase).
Les notifications sont non-bloquantes : les erreurs sont loguees mais ne font jamais echouer les operations metier.

## Architecture

```
lib/notifications/
  types.ts                 # Types TypeScript
  notification-service.ts  # Orchestrateur principal
  email-service.ts         # Wrapper Resend
  templates.ts             # Templates email HTML/text

app/api/
  notifications/route.ts          # CRUD notifications in-app
  notification-preferences/route.ts  # Preferences utilisateur
  shifts/route.ts                 # Triggers notifications sur CRUD shifts
  cron/weekly-summary/route.ts    # Cron resume hebdomadaire

components/notifications/
  NotificationBell.tsx     # Cloche + dropdown (polling 30s)

app/preferences/notifications/
  page.tsx                 # Page de configuration des preferences
```

## Types de notifications

| Type | Description | Email | In-App | Trigger |
|------|-------------|-------|--------|---------|
| `shift_created` | Nouveau shift planifie | oui | oui | POST /api/shifts |
| `shift_updated` | Shift modifie | oui | oui | PUT /api/shifts |
| `shift_deleted` | Shift supprime | oui | oui | DELETE /api/shifts |
| `leave_requested` | Demande conge (manager) | oui | oui | API conges |
| `leave_approved` | Conge approuve | oui | oui | API conges |
| `leave_rejected` | Conge refuse | oui | oui | API conges |
| `compliance_alert` | Alerte conformite | oui | oui | Validation planning |
| `weekly_summary` | Resume hebdomadaire | oui | oui | Cron lundi 9h |

## Configuration

### Variables d'environnement

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email (Resend)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@pharmaplanning.fr   # optionnel
RESEND_FROM_NAME=PharmaPlanning               # optionnel

# App
NEXT_PUBLIC_APP_URL=https://pharmaplanning.vercel.app

# Cron
CRON_SECRET=xxxxx
```

### Tables Supabase

**notifications** — Notifications in-app
- `id` (uuid, PK)
- `organization_id` (uuid, FK)
- `employee_id` (uuid, FK, nullable)
- `type` (text)
- `priority` (text: low, normal, high, urgent)
- `title` (text)
- `message` (text)
- `action_url` (text, nullable)
- `data` (jsonb, nullable)
- `read` (boolean, default false)
- `created_at` (timestamptz)

**notification_preferences** — Preferences par employe
- `id` (uuid, PK)
- `organization_id` (uuid, FK)
- `employee_id` (uuid, FK)
- `email_enabled` (boolean, default true)
- `in_app_enabled` (boolean, default true)
- `types` (jsonb) — `{ "shift_created": { "email": true, "inApp": true }, ... }`
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Usage

### Envoyer une notification

```typescript
import { NotificationService } from '@/lib/notifications/notification-service';

await NotificationService.send({
  type: 'shift_created',
  priority: 'normal',
  organizationId: orgId,
  employeeId: empId,
  recipientEmail: 'jean@pharmacie-coquelicots.fr',
  recipientName: 'Jean Dupont',
  title: 'Nouveau shift',
  message: 'Shift planifie le 2026-02-15',
  actionUrl: '/planning',
  data: {
    date: '2026-02-15',
    startTime: '09:00',
    endTime: '17:00',
    hours: 8,
  },
});
```

### Envoi en lot

```typescript
await NotificationService.sendBulk([payload1, payload2, payload3]);
```

## Tests

### Via script CLI

```bash
npm run test:notifications
```

### Via page de test (dev uniquement)

```
http://localhost:3000/test-notifications
```

## Debogage

Les logs console suivent un format structure :

| Prefixe | Source |
|---------|--------|
| `[NotificationService]` | Orchestrateur principal |
| `[Email]` | Template + envoi email |
| `[InApp]` | Sauvegarde BDD |
| `[Preferences]` | Chargement preferences |
| `[API]` | Routes API (shifts, etc.) |

### Flux complet d'un shift cree

```
🔵 [API] POST /api/shifts
📝 [API] Single shift mode
✅ [API] Shift created: abc-123
📧 [API] Triggering notification for Jean Dupont (jean@pharmacie-coquelicots.fr)
🔔 [NotificationService] send() called
📧 [NotificationService] Type: shift_created
👤 [NotificationService] Recipient: jean@pharmacie-coquelicots.fr
⚙️ [NotificationService] Fetching employee preferences...
ℹ️ [Preferences] No preferences found, using defaults for: emp-456
✅ [NotificationService] Preferences loaded: { emailEnabled: true, inAppEnabled: true }
📧 [NotificationService] Sending email notification...
📧 [Email] Looking for template: shift_created
✅ [Email] Template found, subject: Nouveau shift planifie le 2026-02-15
📧 [Email] Sending to: jean@pharmacie-coquelicots.fr
[Notification Email] Email envoye: xxx a jean@pharmacie-coquelicots.fr
✅ [Email] Sent successfully to jean@pharmacie-coquelicots.fr
📱 [NotificationService] Saving in-app notification...
📱 [InApp] Saving to database...
✅ [InApp] Saved successfully
✅ [NotificationService] Notification processed successfully
✅ [API] Notification triggered
```
