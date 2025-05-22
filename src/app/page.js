'use client';

import { useRef, useState, useEffect } from 'react';
import VideoCapture from '../components/VideoCapture';
import ProgressBar from '../components/ProgressBar';
import { useEmotionWorker } from '../hooks/useEmotionWorker';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showVideo, setShowVideo] = useState(true); // Make video visible by default
  const [videoStream, setVideoStream] = useState(null);
  
  const {
    emotion,
    score,
    loading,
    modelReady,
    error,
    progressItems,
    captureAndClassify,
    setError
  } = useEmotionWorker();

  // Ensure video stream continues even when UI is hidden
  useEffect(() => {
    // This effect ensures video stream continues when visibility changes
    const setupVideo = async () => {
      try {
        if (!videoStream && videoRef.current) {
          // Only initialize stream if not already set
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user" 
            } 
          });
          setVideoStream(stream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else if (videoStream && videoRef.current) {
          // Reconnect existing stream if video ref changes
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Video stream error:', err);
        setError('Failed to access webcam. Please ensure camera permissions are granted.');
      }
    };

    setupVideo();

    // Cleanup on unmount
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    };
  }, [videoRef, videoStream, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading || !modelReady) return;
    
    try {
      // Make sure video stream is active
      if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
        setError('Video stream is not available. Please reload the page.');
        return;
      }

      // Ensure video is playing
      if (videoRef.current.paused) {
        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Failed to play video:', err);
        }
      }
      
      // Capture the image and store it
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas) {
        setError('Video or canvas is not available');
        return;
      }
      
      // Make sure video is ready
      if (video.readyState < 2) {
        await new Promise(resolve => {
          video.onloadeddata = resolve;
          // If already loaded, resolve immediately
          if (video.readyState >= 2) resolve();
        });
      }
      
      // Draw the current video frame to canvas
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Force a fresh frame from the video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log('Captured frame from video:', canvas.width, 'x', canvas.height);
      
      // Save the captured image
      const imageUrl = canvas.toDataURL('image/png');
      setCapturedImage(imageUrl);
      
      // Capture emotion and wait for result
      const emotionResult = await captureAndClassify(videoRef, canvasRef);
      
      // Display result as JSON
      setResult({
        input: inputText,
        emotion: emotionResult.emotion,
        score: emotionResult.score
      });
    } catch (err) {
      console.error('Submit error:', err);
      setError(typeof err === 'string' ? err : 'Failed to process emotion. Please try again.');
    }
  };

  // Toggle video visibility without stopping the stream
  const toggleVideoVisibility = () => {
    setShowVideo(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-indigo-800 tracking-tight">Quantum Poem</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 hover:shadow-2xl">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-sm text-red-600 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Video capture - toggle visibility but keep stream active */}
        <div className={showVideo ? "" : "hidden"}>
          <p className="text-sm text-gray-700 mb-2">Đảm bảo khuôn mặt của bạn hiện rõ trong khung hình:</p>
          <VideoCapture
            videoRef={videoRef}
            canvasRef={canvasRef}
            onError={setError}
          />
          <div className="flex justify-end mb-4">
            <button 
              onClick={toggleVideoVisibility} 
              className="text-sm text-blue-600 underline"
            >
              {showVideo ? "Ẩn camera" : "Hiện camera"}
            </button>
          </div>
        </div>

        {!showVideo && (
          <div className="mb-4 text-right">
            <button 
              onClick={toggleVideoVisibility} 
              className="text-sm text-blue-600 underline"
            >
              Hiện camera
            </button>
          </div>
        )}

        {/* Loading status */}
        <ProgressBar progressItems={progressItems} />
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-4">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter your text here..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              disabled={!modelReady || loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !modelReady || !inputText.trim()}
            className={`w-full py-3 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] ${
              loading || !modelReady || !inputText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg'
            }`}
          >
            {loading ? 'Processing...' : modelReady ? 'Submit' : 'Loading Model...'}
          </button>
        </form>
        
        {/* Results display */}
        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">Result:</h3>
            
            {/* Display captured image */}
            {capturedImage && (
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">Captured Image:</p>
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full rounded-lg border border-gray-200 mb-3" 
                />
              </div>
            )}
            
            <div className="bg-gray-100 p-3 rounded overflow-x-auto">
              <pre className="text-gray-800 font-mono text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}