'use client';

import dynamic from 'next/dynamic';

const WordSphere = dynamic(() => import('../../components/WordSphere/WordSphere'), {
  ssr: false,
  loading: () => <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading 3D...</div>
});

export default function SpherePage() {
  return (
    <div className="relative min-h-screen">
      <WordSphere />
    </div>
  );
}


