'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

function ActivateAccountContent() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Récupérer et vérifier le token d'invitation
  useEffect(() => {
    async function checkSession() {
      try {
        // Supabase gère automatiquement le hash fragment (#access_token=...)
        // lors de l'arrivée depuis un lien d'invitation
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.email) {
          setEmail(session.user.email);
        }
      } catch (err) {
        console.error('Erreur verification session:', err);
      } finally {
        setInitializing(false);
      }
    }

    // Écouter les changements auth (token recovery depuis le hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED') && session?.user?.email) {
          setEmail(session.user.email);
          setInitializing(false);
        }
      }
    );

    checkSession();

    return () => subscription.unsubscribe();
  }, [supabase]);

  function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;

    if (score <= 1) return { score, label: 'Faible', color: '#ef4444' };
    if (score === 2) return { score, label: 'Moyen', color: '#f59e0b' };
    if (score === 3) return { score, label: 'Bon', color: '#3b82f6' };
    return { score, label: 'Fort', color: '#10b981' };
  }

  function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une majuscule';
    if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une minuscule';
    if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre';
    return null;
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validations
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      // 1. Mettre à jour le mot de passe utilisateur
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Erreur lors de la mise a jour du compte');
      }

      // 2. Lier user_id à l'employé via l'API Route
      const activateRes = await fetch('/api/employees/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          email: email.toLowerCase(),
        }),
      });

      if (!activateRes.ok) {
        const errData = await activateRes.json();
        console.error('Erreur activation employe:', errData);
        // Non bloquant — le mot de passe est déjà mis à jour
      }

      setSuccess(true);

      // 3. Rediriger vers le portail employé après 2 secondes
      setTimeout(() => {
        router.push('/employe');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'activation du compte';
      console.error('Erreur activation:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const strength = getPasswordStrength(password);

  if (initializing) {
    return (
      <>
        <div className="activate-page">
          <div className="loading-card">
            <span className="spinner-large" />
            <p>Verification du lien d&apos;activation...</p>
          </div>
        </div>
        <style jsx>{`
          .activate-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%);
            padding: 20px;
          }
          .loading-card {
            background: white;
            border-radius: 16px;
            padding: 60px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          }
          .spinner-large {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0;
            border-top-color: #059669;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
          }
          p { color: #64748b; font-size: 15px; margin: 0; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  if (success) {
    return (
      <>
        <div className="activate-page">
          <div className="success-card">
            <div className="success-icon">&#9989;</div>
            <h1>Compte active !</h1>
            <p>Redirection vers votre espace employe...</p>
          </div>
        </div>
        <style jsx>{`
          .activate-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%);
            padding: 20px;
          }
          .success-card {
            background: white;
            border-radius: 16px;
            padding: 60px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            max-width: 400px;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: bounce 0.6s ease;
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-16px); }
          }
          h1 { margin: 0 0 12px 0; font-size: 24px; color: #1e293b; }
          p { margin: 0; color: #64748b; font-size: 15px; }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="activate-page">
        <div className="activate-card">
          <div className="header">
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="white" fillOpacity="0.2" />
              <path d="M14 6v16M6 14h16" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <h1>PharmaPlanning</h1>
            <h2>Activez votre compte</h2>
          </div>

          <form onSubmit={handleActivate}>
            <div className="form-group">
              <label htmlFor="activate-email">Email professionnel</label>
              <input
                id="activate-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!email}
                placeholder="votre.email@pharmacie.fr"
                autoComplete="email"
              />
              {email && (
                <p className="help-text">&#10003; Email verifie</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="activate-password">Nouveau mot de passe</label>
              <input
                id="activate-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caracteres"
                required
                autoComplete="new-password"
              />
              {password && (
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${(strength.score / 4) * 100}%`, backgroundColor: strength.color }} />
                </div>
              )}
              <ul className="password-requirements">
                <li className={password.length >= 8 ? 'valid' : ''}>
                  {password.length >= 8 ? '\u2713' : '\u25CB'} Au moins 8 caracteres
                </li>
                <li className={/[A-Z]/.test(password) ? 'valid' : ''}>
                  {/[A-Z]/.test(password) ? '\u2713' : '\u25CB'} Une majuscule
                </li>
                <li className={/[a-z]/.test(password) ? 'valid' : ''}>
                  {/[a-z]/.test(password) ? '\u2713' : '\u25CB'} Une minuscule
                </li>
                <li className={/[0-9]/.test(password) ? 'valid' : ''}>
                  {/[0-9]/.test(password) ? '\u2713' : '\u25CB'} Un chiffre
                </li>
              </ul>
            </div>

            <div className="form-group">
              <label htmlFor="activate-confirm">Confirmer le mot de passe</label>
              <input
                id="activate-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez votre mot de passe"
                required
                autoComplete="new-password"
              />
              {confirmPassword && (
                <p className={`match-indicator ${password === confirmPassword ? 'match' : 'no-match'}`}>
                  {password === confirmPassword ? '\u2713 Mots de passe identiques' : '\u2717 Mots de passe differents'}
                </p>
              )}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Activation en cours...
                </>
              ) : (
                'Activer mon compte'
              )}
            </button>
          </form>

          <div className="footer">
            <p>Vous avez deja un compte ?</p>
            <a href="/login">Se connecter</a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .activate-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%);
          padding: 20px;
          font-family: var(--font-family-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        }

        .activate-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          max-width: 480px;
          width: 100%;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }

        .header svg {
          margin-bottom: 12px;
        }

        .header h1 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 700;
        }

        .header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 400;
          opacity: 0.95;
        }

        form {
          padding: 32px 30px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #475569;
          font-size: 14px;
        }

        input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.2s;
          box-sizing: border-box;
          background: white;
        }

        input:focus {
          outline: none;
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        }

        input:disabled {
          background: #f1f5f9;
          cursor: not-allowed;
        }

        .help-text {
          margin: 6px 0 0 0;
          font-size: 13px;
          color: #059669;
          font-weight: 600;
        }

        .strength-bar {
          width: 100%;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }

        .strength-fill {
          height: 100%;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .password-requirements {
          list-style: none;
          padding: 12px 0 0 0;
          margin: 0;
          font-size: 13px;
        }

        .password-requirements li {
          padding: 3px 0;
          color: #94a3b8;
          transition: color 0.2s;
        }

        .password-requirements li.valid {
          color: #059669;
          font-weight: 600;
        }

        .match-indicator {
          margin: 6px 0 0 0;
          font-size: 13px;
          font-weight: 600;
        }

        .match-indicator.match {
          color: #059669;
        }

        .match-indicator.no-match {
          color: #ef4444;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        button {
          width: 100%;
          padding: 14px;
          background: #059669;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        button:hover:not(:disabled) {
          background: #047857;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .footer {
          padding: 20px 30px;
          background: #f8fafc;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }

        .footer p {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #64748b;
        }

        .footer a {
          color: #059669;
          font-weight: 600;
          text-decoration: none;
          font-size: 15px;
        }

        .footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .activate-page {
            padding: 12px;
          }
          .header {
            padding: 32px 24px;
          }
          form {
            padding: 24px 20px;
          }
        }
      `}</style>
    </>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%)' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#64748b' }}>Chargement...</p>
        </div>
      </div>
    }>
      <ActivateAccountContent />
    </Suspense>
  );
}
