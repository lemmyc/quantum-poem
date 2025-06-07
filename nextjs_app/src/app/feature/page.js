import { Suspense } from 'react';
import FeatureClient from './FeatureClient'; // Import component client vừa tạo

// Component này giờ là Server Component (không có 'use client')
export default function FeaturePage() {
  return (
    // Bọc component client bằng Suspense
    // fallback là UI sẽ hiển thị trong khi chờ FeatureClient tải
    <Suspense fallback={<Loading />}>
      <FeatureClient />
    </Suspense>
  );
}

// Một component Loading đơn giản để làm fallback
function Loading() {
  return (
    <div style={{
      minHeight:'100vh',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontSize: '1.5rem'
    }}>
      Loading Page...
    </div>
  );
}