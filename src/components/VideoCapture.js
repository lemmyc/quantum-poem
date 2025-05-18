'use client';

import { useRef, useEffect } from 'react';

export default function VideoCapture({ videoRef, canvasRef, onError }) {
  useEffect(() => {
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        onError('Failed to access webcam. Please ensure camera permissions are granted.');
      }
    }
    startWebcam();
  }, [videoRef, onError]);

  return (
    <div className="relative overflow-hidden rounded-xl mb-6">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-auto rounded-xl transform transition-transform duration-300 hover:scale-[1.02]"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
} 