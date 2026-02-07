/**
 * Service de notifications — Server-side only
 *
 * Orchestre l'envoi des notifications selon les preferences de l'employe :
 *  - Email via Resend
 *  - In-app via table `notifications` en BDD
 *
 * Utilise getServiceClient() (service_role) pour bypasser le RLS.
 * Les erreurs sont loguees mais ne font jamais echouer les operations metier.
 */

import { createClient } from '@supabase/supabase-js';
import type { NotificationPayload, NotificationType, NotificationPreferences } from './types';
import { sendEmail } from './email-service';
import {
  getShiftCreatedTemplate,
  getLeaveApprovedTemplate,
  getLeaveRejectedTemplate,
  getLeaveRequestedTemplate,
  getComplianceAlertTemplate,
  getWeeklySummaryTemplate,
} from './templates';

/** Client service_role pour operations BDD (bypasse RLS) */
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Tous les types de notification disponibles */
const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'shift_created',
  'shift_updated',
  'shift_deleted',
  'leave_requested',
  'leave_approved',
  'leave_rejected',
  'compliance_alert',
  'weekly_summary',
];

/** Preferences par defaut (tout active) */
function getDefaultPreferences(): Omit<NotificationPreferences, 'id' | 'organization_id' | 'employee_id' | 'created_at' | 'updated_at'> {
  const types: NotificationPreferences['types'] = {};
  ALL_NOTIFICATION_TYPES.forEach(type => {
    types[type] = { email: true, inApp: true };
  });

  return {
    email_enabled: true,
    in_app_enabled: true,
    types,
  };
}

export class NotificationService {
  /**
   * Envoyer une notification (email + in-app selon preferences)
   * Non-bloquant : les erreurs sont loguees mais ne propagent pas.
   */
  static async send(payload: NotificationPayload): Promise<void> {
    try {
      const prefs = await this.getEmployeePreferences(
        payload.organizationId,
        payload.employeeId,
      );

      const typePrefs = prefs.types[payload.type as NotificationType];
      const emailEnabled = prefs.email_enabled && (typePrefs?.email ?? true);
      const inAppEnabled = prefs.in_app_enabled && (typePrefs?.inApp ?? true);

      // Email
      if (emailEnabled) {
        await this.sendEmailNotification(payload);
      }

      // In-app
      if (inAppEnabled) {
        await this.saveInAppNotification(payload);
      }
    } catch (err) {
      console.error('[NotificationService] Erreur send:', err);
    }
  }

  /** Envoyer un email selon le type de notification */
  private static async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    try {
      const template = this.getEmailTemplate(payload);
      if (!template) {
        console.warn('[NotificationService] Pas de template email pour:', payload.type);
        return;
      }

      await sendEmail(payload.recipientEmail, template);
    } catch (err) {
      console.error('[NotificationService] Erreur email:', err);
    }
  }

  /** Generer le template email selon le type */
  private static getEmailTemplate(payload: NotificationPayload) {
    const data = payload.data || {};

    switch (payload.type) {
      case 'shift_created':
        return getShiftCreatedTemplate({
          employeeName: payload.recipientName,
          date: (data.date as string) || '',
          startTime: (data.startTime as string) || '',
          endTime: (data.endTime as string) || '',
          hours: (data.hours as number) || 0,
        });

      case 'leave_approved':
        return getLeaveApprovedTemplate({
          employeeName: payload.recipientName,
          startDate: (data.startDate as string) || '',
          endDate: (data.endDate as string) || '',
          days: (data.days as number) || 0,
          type: (data.leaveType as string) || '',
        });

      case 'leave_rejected':
        return getLeaveRejectedTemplate({
          employeeName: payload.recipientName,
          startDate: (data.startDate as string) || '',
          endDate: (data.endDate as string) || '',
          type: (data.leaveType as string) || '',
        });

      case 'leave_requested':
        return getLeaveRequestedTemplate({
          managerName: payload.recipientName,
          employeeName: (data.employeeName as string) || '',
          startDate: (data.startDate as string) || '',
          endDate: (data.endDate as string) || '',
          days: (data.days as number) || 0,
          type: (data.leaveType as string) || '',
        });

      case 'compliance_alert':
        return getComplianceAlertTemplate({
          managerName: payload.recipientName,
          violationType: (data.violationType as string) || '',
          message: (data.message as string) || '',
          suggestion: (data.suggestion as string) || '',
        });

      case 'weekly_summary':
        return getWeeklySummaryTemplate({
          managerName: payload.recipientName,
          weekNumber: (data.weekNumber as number) || 0,
          year: (data.year as number) || 0,
          totalHours: (data.totalHours as number) || 0,
          totalShifts: (data.totalShifts as number) || 0,
          employeesCount: (data.employeesCount as number) || 0,
        });

      default:
        return null;
    }
  }

  /** Sauvegarder une notification in-app en BDD */
  private static async saveInAppNotification(payload: NotificationPayload): Promise<void> {
    try {
      const supabase = getServiceClient();

      const { error } = await supabase.from('notifications').insert({
        organization_id: payload.organizationId,
        employee_id: payload.employeeId,
        type: payload.type,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
        action_url: payload.actionUrl || null,
        data: payload.data || null,
        read: false,
      });

      if (error) {
        console.error('[NotificationService] Erreur insert notification:', error);
      }
    } catch (err) {
      console.error('[NotificationService] Erreur saveInApp:', err);
    }
  }

  /** Recuperer les preferences d'un employe (ou defaut) */
  private static async getEmployeePreferences(
    organizationId: string,
    employeeId: string,
  ): Promise<Pick<NotificationPreferences, 'email_enabled' | 'in_app_enabled' | 'types'>> {
    try {
      const supabase = getServiceClient();

      const { data } = await supabase
        .from('notification_preferences')
        .select('email_enabled, in_app_enabled, types')
        .eq('organization_id', organizationId)
        .eq('employee_id', employeeId)
        .single();

      if (data) {
        return {
          email_enabled: data.email_enabled,
          in_app_enabled: data.in_app_enabled,
          types: (data.types as NotificationPreferences['types']) || {},
        };
      }
    } catch {
      // Pas de preferences trouvees, utiliser le defaut
    }

    return getDefaultPreferences();
  }

  /** Envoi en lot (pour les notifications batch comme shift_created x N) */
  static async sendBulk(payloads: NotificationPayload[]): Promise<void> {
    await Promise.allSettled(payloads.map(p => this.send(p)));
  }
}
