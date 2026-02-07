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
  getShiftUpdatedTemplate,
  getShiftDeletedTemplate,
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
    console.log('🔔 [NotificationService] send() called');
    console.log('📧 [NotificationService] Type:', payload.type);
    console.log('👤 [NotificationService] Recipient:', payload.recipientEmail);

    try {
      console.log('⚙️ [NotificationService] Fetching employee preferences...');
      const prefs = await this.getEmployeePreferences(
        payload.organizationId,
        payload.employeeId,
      );

      console.log('✅ [NotificationService] Preferences loaded:', {
        emailEnabled: prefs.email_enabled,
        inAppEnabled: prefs.in_app_enabled,
      });

      const typePrefs = prefs.types[payload.type as NotificationType];
      const emailEnabled = prefs.email_enabled && (typePrefs?.email ?? true);
      const inAppEnabled = prefs.in_app_enabled && (typePrefs?.inApp ?? true);

      // Email
      if (emailEnabled) {
        console.log('📧 [NotificationService] Sending email notification...');
        await this.sendEmailNotification(payload);
      } else {
        console.log('🔕 [NotificationService] Email disabled for type:', payload.type);
      }

      // In-app
      if (inAppEnabled) {
        console.log('📱 [NotificationService] Saving in-app notification...');
        await this.saveInAppNotification(payload);
      } else {
        console.log('🔕 [NotificationService] In-app disabled for type:', payload.type);
      }

      console.log('✅ [NotificationService] Notification processed successfully');
    } catch (err) {
      console.error('❌ [NotificationService] Erreur send:', err);
    }
  }

  /** Envoyer un email selon le type de notification */
  private static async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    try {
      console.log('📧 [Email] Looking for template:', payload.type);

      const template = this.getEmailTemplate(payload);
      if (!template) {
        console.warn('⚠️ [Email] No template found for type:', payload.type);
        return;
      }

      console.log('✅ [Email] Template found, subject:', template.subject);
      console.log('📧 [Email] Sending to:', payload.recipientEmail);

      const result = await sendEmail(payload.recipientEmail, template);

      if (result.success) {
        console.log('✅ [Email] Sent successfully to', payload.recipientEmail);
      } else {
        console.error('❌ [Email] Failed:', result.error);
      }
    } catch (err) {
      console.error('❌ [Email] Exception:', err);
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

      case 'shift_updated':
        return getShiftUpdatedTemplate({
          employeeName: payload.recipientName,
          date: (data.date as string) || '',
          startTime: (data.startTime as string) || '',
          endTime: (data.endTime as string) || '',
          hours: (data.hours as number) || 0,
        });

      case 'shift_deleted':
        return getShiftDeletedTemplate({
          employeeName: payload.recipientName,
          date: (data.date as string) || '',
          startTime: (data.startTime as string) || '',
          endTime: (data.endTime as string) || '',
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
      console.log('📱 [InApp] Saving to database...');

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
        console.error('❌ [InApp] Database error:', error);
      } else {
        console.log('✅ [InApp] Saved successfully');
      }
    } catch (err) {
      console.error('❌ [InApp] Exception:', err);
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
        console.log('✅ [Preferences] Found preferences for employee:', employeeId);
        return {
          email_enabled: data.email_enabled,
          in_app_enabled: data.in_app_enabled,
          types: (data.types as NotificationPreferences['types']) || {},
        };
      }
    } catch {
      // Pas de preferences trouvees, utiliser le defaut
    }

    console.log('ℹ️ [Preferences] No preferences found, using defaults for:', employeeId);
    return getDefaultPreferences();
  }

  /** Envoi en lot (pour les notifications batch comme shift_created x N) */
  static async sendBulk(payloads: NotificationPayload[]): Promise<void> {
    console.log(`🔔 [NotificationService] Sending ${payloads.length} notifications in bulk`);
    await Promise.allSettled(payloads.map(p => this.send(p)));
    console.log('✅ [NotificationService] Bulk send complete');
  }
}
