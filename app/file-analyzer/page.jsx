'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FileAnalyzerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17', color: '#94a3b8' }}>
      <p style={{ fontSize: 14 }}>Redirecting to SIG-SCOPE Dashboard...</p>
    </div>
  );
}
