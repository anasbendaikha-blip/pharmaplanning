/**
 * Types du systeme de notifications PharmaPlanning
 *
 * Utilise employee_id (pas user_id) car les employes ne sont pas lies
 * aux comptes auth.users dans le schema actuel.
 */

export type NotificationType =
  | 'shift_created'
  | 'shift_updated'
  | 'shift_deleted'
  | 'leave_requested'
  | 'leave_approved'
  | 'leave_rejected'
  | 'compliance_alert'
  | 'weekly_summary';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Payload pour creer une notification (server-side) */
export interface NotificationPayload {
  type: NotificationType;
  priority: NotificationPriority;
  organizationId: string;
  employeeId: string;
  recipientEmail: string;
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

/** Template email genere par les fonctions de templates */
export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/** Preferences de notification par employe */
export interface NotificationPreferences {
  id: string;
  organization_id: string;
  employee_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  types: {
    [key in NotificationType]?: {
      email: boolean;
      inApp: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

/** Notification in-app (row DB) */
export interface DbNotification {
  id: string;
  organization_id: string;
  employee_id: string | null;
  type: string;
  priority: string;
  title: string;
  message: string;
  action_url: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

/** Labels francais pour les types de notification */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  shift_created: 'Nouveau shift cree',
  shift_updated: 'Shift modifie',
  shift_deleted: 'Shift supprime',
  leave_requested: 'Demande de conge',
  leave_approved: 'Conge approuve',
  leave_rejected: 'Conge refuse',
  compliance_alert: 'Alerte conformite',
  weekly_summary: 'Resume hebdomadaire',
};

/** Labels francais pour les priorites */
export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};
