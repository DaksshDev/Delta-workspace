import { useEffect, useState } from 'react';
import { getDB } from './store';

export function useEcsQuery<T>(queryFn: () => Promise<T>, dependencies: any[] = []): { data: T | undefined, loading: boolean, refetch: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(prev => data === undefined ? true : prev);
    try {
      const result = await queryFn();
      setData(result);
    } catch (e) {
      console.error('ECS Query Error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  // Listen for real-time background sync updates
  useEffect(() => {
    const handleDataChange = () => fetchData();
    window.addEventListener('delta-data-changed', handleDataChange);
    return () => window.removeEventListener('delta-data-changed', handleDataChange);
  }, dependencies);

  return { data, loading, refetch: fetchData };
}
