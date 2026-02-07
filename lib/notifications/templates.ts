/**
 * Templates email pour les notifications PharmaPlanning
 *
 * Conventions :
 *  - Pas d'emojis : texte professionnel uniquement
 *  - Couleur brand : #2e7d32 (vert pharmacie = --color-primary-800)
 *  - Tous les liens pointent vers NEXT_PUBLIC_APP_URL
 */

import type { EmailTemplate } from './types';

const BRAND_COLOR = '#2e7d32';
const BRAND_NAME = 'PharmaPlanning';

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://pharmaplanning.vercel.app';
}

/** Layout HTML commun a tous les emails */
function getBaseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f8fafc;
    }
    .header {
      background: ${BRAND_COLOR};
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 { margin: 0; font-size: 20px; }
    .content {
      background: white;
      padding: 30px;
      border: 1px solid #e2e8f0;
      border-top: none;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      border: 1px solid #e2e8f0;
      border-top: none;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: ${BRAND_COLOR};
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .alert {
      padding: 16px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      margin: 20px 0;
    }
    .info-box {
      background: #f8fafc;
      padding: 16px;
      border-radius: 6px;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 600; color: #475569; }
    .info-value { color: #1e293b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${BRAND_NAME}</h1>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Cet email a ete envoye automatiquement par ${BRAND_NAME}.</p>
    <p>Pour modifier vos preferences de notification, connectez-vous a votre compte.</p>
  </div>
</body>
</html>`;
}

// ─── SHIFT CREE ───

export function getShiftCreatedTemplate(data: {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}): EmailTemplate {
  const subject = `Nouveau shift planifie le ${data.date}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.employeeName},</h2>
    <p>Un nouveau shift vient d'etre planifie pour vous :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Date</span>
        <span class="info-value">${data.date}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Horaires</span>
        <span class="info-value">${data.startTime} - ${data.endTime}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Duree</span>
        <span class="info-value">${data.hours}h</span>
      </div>
    </div>

    <p>Consultez votre planning complet pour plus de details.</p>
    <a href="${getAppUrl()}/planning" class="button">Voir mon planning</a>
  `);

  const textBody = `Bonjour ${data.employeeName},

Un nouveau shift vient d'etre planifie pour vous :

Date : ${data.date}
Horaires : ${data.startTime} - ${data.endTime}
Duree : ${data.hours}h

Consultez votre planning : ${getAppUrl()}/planning`;

  return { subject, htmlBody, textBody };
}

// ─── SHIFT MODIFIE ───

export function getShiftUpdatedTemplate(data: {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}): EmailTemplate {
  const subject = `Shift modifie le ${data.date}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.employeeName},</h2>
    <p>Un de vos shifts a ete modifie :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Date</span>
        <span class="info-value">${data.date}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Nouveaux horaires</span>
        <span class="info-value">${data.startTime} - ${data.endTime}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Duree</span>
        <span class="info-value">${data.hours}h</span>
      </div>
    </div>

    <p>Consultez votre planning pour voir les modifications.</p>
    <a href="${getAppUrl()}/planning" class="button">Voir mon planning</a>
  `);

  const textBody = `Bonjour ${data.employeeName},

Un de vos shifts a ete modifie :

Date : ${data.date}
Nouveaux horaires : ${data.startTime} - ${data.endTime}
Duree : ${data.hours}h

Consultez votre planning : ${getAppUrl()}/planning`;

  return { subject, htmlBody, textBody };
}

// ─── SHIFT SUPPRIME ───

export function getShiftDeletedTemplate(data: {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
}): EmailTemplate {
  const subject = `Shift supprime le ${data.date}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.employeeName},</h2>
    <p>Un de vos shifts a ete supprime :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Date</span>
        <span class="info-value">${data.date}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Horaires</span>
        <span class="info-value">${data.startTime} - ${data.endTime}</span>
      </div>
    </div>

    <p>Consultez votre planning pour voir les changements.</p>
    <a href="${getAppUrl()}/planning" class="button">Voir mon planning</a>
  `);

  const textBody = `Bonjour ${data.employeeName},

Un de vos shifts a ete supprime :

Date : ${data.date}
Horaires : ${data.startTime} - ${data.endTime}

Consultez votre planning : ${getAppUrl()}/planning`;

  return { subject, htmlBody, textBody };
}

// ─── CONGE APPROUVE ───

export function getLeaveApprovedTemplate(data: {
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
}): EmailTemplate {
  const subject = `Conge approuve : ${data.startDate} - ${data.endDate}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.employeeName},</h2>
    <p>Bonne nouvelle ! Votre demande de conge a ete approuvee :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Type</span>
        <span class="info-value">${data.type}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Debut</span>
        <span class="info-value">${data.startDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fin</span>
        <span class="info-value">${data.endDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Duree</span>
        <span class="info-value">${data.days} jour(s) ouvres</span>
      </div>
    </div>

    <a href="${getAppUrl()}/calendrier-conges" class="button">Voir mes conges</a>
  `);

  const textBody = `Bonjour ${data.employeeName},

Votre demande de conge a ete approuvee :

Type : ${data.type}
Debut : ${data.startDate}
Fin : ${data.endDate}
Duree : ${data.days} jour(s) ouvres

Voir mes conges : ${getAppUrl()}/calendrier-conges`;

  return { subject, htmlBody, textBody };
}

// ─── CONGE REFUSE ───

export function getLeaveRejectedTemplate(data: {
  employeeName: string;
  startDate: string;
  endDate: string;
  type: string;
}): EmailTemplate {
  const subject = `Conge refuse : ${data.startDate} - ${data.endDate}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.employeeName},</h2>
    <p>Votre demande de conge n'a pas ete approuvee :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Type</span>
        <span class="info-value">${data.type}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Debut</span>
        <span class="info-value">${data.startDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fin</span>
        <span class="info-value">${data.endDate}</span>
      </div>
    </div>

    <p>Veuillez contacter votre responsable pour plus d'informations.</p>
    <a href="${getAppUrl()}/calendrier-conges" class="button">Voir mes conges</a>
  `);

  const textBody = `Bonjour ${data.employeeName},

Votre demande de conge n'a pas ete approuvee :

Type : ${data.type}
Debut : ${data.startDate}
Fin : ${data.endDate}

Contactez votre responsable pour plus d'informations.
Voir mes conges : ${getAppUrl()}/calendrier-conges`;

  return { subject, htmlBody, textBody };
}

// ─── DEMANDE DE CONGE (pour le manager) ───

export function getLeaveRequestedTemplate(data: {
  managerName: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
}): EmailTemplate {
  const subject = `Nouvelle demande de conge de ${data.employeeName}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.managerName},</h2>
    <p>${data.employeeName} a soumis une demande de conge :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Employe</span>
        <span class="info-value">${data.employeeName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Type</span>
        <span class="info-value">${data.type}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Debut</span>
        <span class="info-value">${data.startDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fin</span>
        <span class="info-value">${data.endDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Duree</span>
        <span class="info-value">${data.days} jour(s) ouvres</span>
      </div>
    </div>

    <a href="${getAppUrl()}/calendrier-conges" class="button">Gerer les conges</a>
  `);

  const textBody = `Bonjour ${data.managerName},

${data.employeeName} a soumis une demande de conge :

Type : ${data.type}
Debut : ${data.startDate}
Fin : ${data.endDate}
Duree : ${data.days} jour(s) ouvres

Gerer les conges : ${getAppUrl()}/calendrier-conges`;

  return { subject, htmlBody, textBody };
}

// ─── ALERTE CONFORMITE ───

export function getComplianceAlertTemplate(data: {
  managerName: string;
  violationType: string;
  message: string;
  suggestion: string;
}): EmailTemplate {
  const subject = `Alerte conformite : ${data.violationType}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.managerName},</h2>

    <div class="alert">
      <strong>Alerte Conformite</strong>
      <p style="margin: 8px 0 0;">${data.message}</p>
    </div>

    <p><strong>Recommandation :</strong></p>
    <p>${data.suggestion}</p>

    <a href="${getAppUrl()}/titulaire/conformite" class="button">Voir le rapport de conformite</a>
  `);

  const textBody = `Bonjour ${data.managerName},

ALERTE CONFORMITE

${data.message}

Recommandation : ${data.suggestion}

Voir le rapport : ${getAppUrl()}/titulaire/conformite`;

  return { subject, htmlBody, textBody };
}

// ─── RESUME HEBDOMADAIRE ───

export function getWeeklySummaryTemplate(data: {
  managerName: string;
  weekNumber: number;
  year: number;
  totalHours: number;
  totalShifts: number;
  employeesCount: number;
}): EmailTemplate {
  const subject = `Resume hebdomadaire - Semaine ${data.weekNumber}`;

  const htmlBody = getBaseTemplate(`
    <h2>Bonjour ${data.managerName},</h2>
    <p>Voici le resume de la semaine ${data.weekNumber} - ${data.year} :</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Total heures</span>
        <span class="info-value">${data.totalHours}h</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total shifts</span>
        <span class="info-value">${data.totalShifts}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Employes actifs</span>
        <span class="info-value">${data.employeesCount}</span>
      </div>
    </div>

    <a href="${getAppUrl()}/titulaire/recap-hebdo" class="button">Voir le rapport complet</a>
  `);

  const textBody = `Bonjour ${data.managerName},

Resume de la semaine ${data.weekNumber} - ${data.year} :

Total heures : ${data.totalHours}h
Total shifts : ${data.totalShifts}
Employes actifs : ${data.employeesCount}

Voir le rapport : ${getAppUrl()}/titulaire/recap-hebdo`;

  return { subject, htmlBody, textBody };
}

