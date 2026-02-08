'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /employes -> /equipe
 * La gestion des employes est maintenant fusionnee dans /equipe
 */
export default function EmployesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/equipe');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#6b7280' }}>
      Redirection vers la page equipe...
    </div>
  );
}
