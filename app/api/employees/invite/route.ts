/**
 * API Route — POST /api/employees/invite
 * Crée un employé et envoie une invitation email
 * Utilise le service_role pour bypasser le RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/notifications/email-service';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface InviteEmployeeRequest {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  contractHours?: number;
  sendInvitation: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: InviteEmployeeRequest = await request.json();

    const {
      organizationId,
      firstName,
      lastName,
      email,
      role,
      contractHours = 35,
      sendInvitation = true,
    } = body;

    // Validation
    if (!email || !firstName || !lastName || !role || !organizationId) {
      return NextResponse.json(
        { error: 'Champs requis manquants (firstName, lastName, email, role, organizationId)' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier que l'email n'existe pas déjà dans cette organisation
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id, account_status')
      .eq('organization_id', organizationId)
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingEmployee) {
      return NextResponse.json(
        { error: `Un employe avec cet email existe deja (statut: ${existingEmployee.account_status || 'inconnu'})` },
        { status: 400 }
      );
    }

    // Créer l'employé dans la table employees
    const name = `${firstName.trim()} ${lastName.trim()}`;
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .insert({
        organization_id: organizationId,
        name: name,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: normalizedEmail,
        role,
        contract_hours: contractHours,
        account_status: 'pending',
        status: 'active',
      })
      .select()
      .single();

    if (employeeError) {
      console.error('Erreur creation employe:', employeeError);
      return NextResponse.json(
        { error: 'Erreur lors de la creation de l\'employe: ' + employeeError.message },
        { status: 500 }
      );
    }

    let invitationSent = false;
    let invitationError = null;

    // Envoyer invitation si demandé
    if (sendInvitation) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pharmaplanning.vercel.app';

        // 1. Créer user Supabase via Admin API (inviteUserByEmail)
        const { data: authData, error: authErr } = await supabase.auth.admin.inviteUserByEmail(
          normalizedEmail,
          {
            data: {
              employee_id: employee.id,
              organization_id: organizationId,
              role: role,
              name: name,
            },
            redirectTo: `${appUrl}/auth/activate`,
          }
        );

        if (authErr) {
          console.error('Erreur invitation Supabase Auth:', authErr);
          invitationError = authErr.message;
        } else {
          invitationSent = true;

          // Mettre à jour date invitation
          await supabase
            .from('employees')
            .update({ invitation_sent_at: new Date().toISOString() })
            .eq('id', employee.id);

          // 2. Envoyer email custom via Resend (en complément)
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', organizationId)
            .single();

          const organizationName = org?.name || 'votre pharmacie';

          // Lien d'activation — on utilise l'ID du user auth créé
          const userId = authData?.user?.id;

          await sendEmail(normalizedEmail, {
            subject: `Bienvenue chez ${organizationName} - Activez votre compte PharmaPlanning`,
            htmlBody: generateInvitationEmailHTML(
              firstName,
              organizationName,
              role,
              `${appUrl}/auth/activate`
            ),
            textBody: `Bonjour ${firstName},\n\nVotre compte PharmaPlanning a ete cree chez ${organizationName}.\nCliquez ici pour activer votre compte : ${appUrl}/auth/activate\n\nCe lien expire dans 7 jours.`,
          });

          // Si on a un userId, on peut créer le mapping user_organizations
          if (userId) {
            await supabase
              .from('user_organizations')
              .upsert({
                user_id: userId,
                organization_id: organizationId,
                role: 'employee',
              }, { onConflict: 'user_id' });
          }
        }
      } catch (inviteErr: unknown) {
        const msg = inviteErr instanceof Error ? inviteErr.message : 'Erreur inconnue';
        console.error('Erreur processus invitation:', msg);
        invitationError = msg;
        // On continue, employé créé même si invitation échoue
      }
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        account_status: employee.account_status,
      },
      invitationSent,
      invitationError,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Erreur API invite:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/** Template HTML email invitation */
function generateInvitationEmailHTML(
  employeeName: string,
  organizationName: string,
  role: string,
  activationUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">&#128138;</div>
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">PharmaPlanning</h1>
      <p style="margin: 0; font-size: 15px; opacity: 0.95;">Gestion de planning pharmacie</p>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #1e293b;">Bonjour ${employeeName},</h2>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px;">Votre compte PharmaPlanning a ete cree par votre responsable chez <strong>${organizationName}</strong>.</p>
      <div style="background: #f8fafc; border-left: 4px solid #059669; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
        <strong style="color: #1e293b;">Votre role :</strong> ${role}
      </div>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px;">Avec PharmaPlanning, vous pouvez :</p>
      <ul style="color: #475569; padding-left: 20px; font-size: 15px;">
        <li>Consulter votre planning personnel</li>
        <li>Soumettre vos disponibilites</li>
        <li>Faire vos demandes de conges en ligne</li>
      </ul>
      <p style="margin: 24px 0 8px 0; color: #475569; font-size: 15px; font-weight: 600;">Pour activer votre compte :</p>
      <ol style="color: #475569; padding-left: 20px; font-size: 15px;">
        <li>Cliquez sur le bouton ci-dessous</li>
        <li>Definissez un mot de passe securise (minimum 8 caracteres)</li>
        <li>Accedez immediatement a votre espace employe</li>
      </ol>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${activationUrl}" style="display: inline-block; background: #059669; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Activer mon compte</a>
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 24px 0; border-radius: 4px; font-size: 13px; color: #92400e;">
        <strong>Important :</strong> Ce lien expire dans 7 jours. Si vous n'avez pas demande ce compte, contactez votre responsable.
      </div>
    </div>
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 12px; color: #64748b;">&copy; ${new Date().getFullYear()} PharmaPlanning - Tous droits reserves</p>
    </div>
  </div>
</body>
</html>`;
}
