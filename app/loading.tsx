import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <LoadingSpinner size="lg" message="Chargement..." />
    </div>
  );
}
