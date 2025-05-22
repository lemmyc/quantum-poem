'use client';

import { useEffect } from 'react';

export default function VideoCapture({ videoRef, canvasRef, onError }) {
  // Stream is now managed by the parent component
  // We only need to handle the UI here
  
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-300 mb-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-auto rounded-lg"
        style={{ maxHeight: '300px', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} className="hidden" width="640" height="480" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="border-4 border-dashed border-blue-400 rounded-full w-32 h-32 opacity-50"></div>
      </div>
    </div>
  );
} 