/**
 * Service d'envoi d'emails via Resend
 *
 * Wrapper autour de l'API Resend avec gestion d'erreurs non-bloquante.
 * Les erreurs sont loguees mais ne font jamais echouer les operations metier.
 */

import { Resend } from 'resend';
import type { EmailTemplate } from './types';

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY non configuree');
  }
  return new Resend(apiKey);
}

/**
 * Envoie un email unique via Resend
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();

    const fromName = process.env.RESEND_FROM_NAME || 'PharmaPlanning';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@pharmaplanning.fr';

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: template.subject,
      html: template.htmlBody,
      text: template.textBody,
    });

    if (error) {
      console.error('[Notification Email] Erreur Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[Notification Email] Email envoye:', data?.id, 'a', to);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[Notification Email] Erreur envoi:', message);
    return { success: false, error: message };
  }
}

/**
 * Envoie un lot d'emails avec rate limiting (100ms entre chaque)
 */
export async function sendBulkEmails(
  emails: Array<{ to: string; template: EmailTemplate }>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendEmail(email.to, email.template);
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // Rate limiting Resend : 10 emails/seconde
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success, failed };
}
