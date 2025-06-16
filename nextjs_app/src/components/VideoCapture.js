'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

// Use forwardRef to allow the parent component to pass a ref down to this component.
const VideoCapture = forwardRef(({ onError }, ref) => {
  // Internal refs to manage the video and canvas elements.
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // useImperativeHandle customizes the instance value that is exposed to parent components when using ref.
  // Here, we only expose the video and canvas elements, not the entire component instance.
  useImperativeHandle(ref, () => ({
    video: videoRef.current,
    canvas: canvasRef.current,
  }));

  // This effect runs ONCE when the component mounts.
  // It also includes a cleanup function that runs when the component unmounts.
  useEffect(() => {
    let stream = null; // To hold the media stream for easy cleanup.

    const setupVideo = async () => {
      // Ensure the video element is available in the DOM.
      if (videoRef.current && !videoRef.current.srcObject) {
        try {
          // Request access to the user's webcam.
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user', // Prefer the front-facing camera.
            },
          });

          videoRef.current.srcObject = stream;
          await videoRef.current.play();

        } catch (err) {
          console.error("Error accessing webcam:", err);
          // Callback to the parent component if an error occurs.
          if (onError) {
            onError("Could not access the webcam. Please grant camera permission.");
          }
        }
      }
    };

    setupVideo();

    // IMPORTANT: Cleanup function.
    // This is called when the component is unmounted (e.g., when the Modal closes).
    return () => {
      if (stream) {
        // Stop all tracks of the stream to turn off the camera.
        stream.getTracks().forEach((track) => track.stop());
        console.log("Camera stream stopped.");
      }
    };
  }, [onError]); // The effect only re-runs if the onError function changes.

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-300 mb-4">
      <video
        // Attach the internal ref.
        ref={videoRef}
        autoPlay
        playsInline // Required for autoplay on many mobile browsers.
        muted // Muting is often required for autoplay.
        className="w-full h-auto rounded-lg"
        style={{ maxHeight: '300px', objectFit: 'cover' }}
      />
      {/* A hidden canvas used for capturing frames from the video. */}
      <canvas ref={canvasRef} className="hidden" width="640" height="480" />
      {/* Visual overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="border-4 border-dashed border-blue-400 rounded-full w-32 h-32 opacity-50"></div>
      </div>
    </div>
  );
});

// Add a displayName for better debugging in React DevTools.
VideoCapture.displayName = 'VideoCapture';

export default VideoCapture;