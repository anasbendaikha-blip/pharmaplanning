'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '40px',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '420px' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '16px' }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '8px',
              }}
            >
              Une erreur est survenue
            </h2>
            <p
              style={{
                color: '#64748b',
                fontSize: '14px',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              {this.state.error?.message || 'Veuillez rafraichir la page ou contacter le support.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '10px 24px',
                backgroundColor: '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Reessayer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
