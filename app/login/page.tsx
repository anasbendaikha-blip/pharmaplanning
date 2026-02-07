'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Email ou mot de passe incorrect');
        } else {
          setError(authError.message);
        }
      } else if (data.user) {
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSuccess('Compte créé ! Vérifiez votre email puis connectez-vous.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <svg
                width="40"
                height="40"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
                <rect width="28" height="28" rx="6" fill="white" fillOpacity="0.2" />
                <path
                  d="M14 6v16M6 14h16"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="logo-text">PharmaPlanning</span>
            </div>
            <h1>Connexion</h1>
            <p>Gestion intelligente des plannings pharmacie</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="message message--error">{error}</div>
            )}

            {success && (
              <div className="message message--success">{success}</div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleSignup}
                disabled={loading}
              >
                Créer un compte
              </button>
            </div>
          </form>

          <div className="login-footer">
            <p>Version SaaS Multi-Tenant</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%);
          padding: 20px;
          font-family: var(--font-family-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        }

        .login-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 420px;
          overflow: hidden;
        }

        .login-header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 40px 32px;
          text-align: center;
        }

        .login-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .logo-text {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .login-header h1 {
          margin: 0 0 8px;
          font-size: 22px;
          font-weight: 700;
        }

        .login-header p {
          margin: 0;
          opacity: 0.85;
          font-size: 14px;
        }

        .login-form {
          padding: 32px;
        }

        .form-field {
          margin-bottom: 20px;
        }

        .form-field label {
          display: block;
          font-weight: 600;
          font-size: 14px;
          color: #334155;
          margin-bottom: 8px;
        }

        .form-field input {
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

        .form-field input:focus {
          outline: none;
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        }

        .form-field input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .message {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .message--error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .message--success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
        }

        .form-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .btn-primary,
        .btn-secondary {
          width: 100%;
          padding: 14px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #059669;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #047857;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .login-footer {
          padding: 20px 32px;
          background: #f8fafc;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }

        .login-footer p {
          margin: 0;
          font-size: 12px;
          color: #94a3b8;
        }
      `}</style>
    </>
  );
}
