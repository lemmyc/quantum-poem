'use client';

import { useRef } from 'react';
import VideoCapture from '../components/VideoCapture';
import ProgressBar from '../components/ProgressBar';
import EmotionResult from '../components/EmotionResult';
import { useEmotionWorker } from '../hooks/useEmotionWorker';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-indigo-800 tracking-tight">Facial Emotion Detection</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 hover:shadow-2xl">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        <VideoCapture
          videoRef={videoRef}
          canvasRef={canvasRef}
          onError={setError}
        />

        <button
          onClick={() => captureAndClassify(videoRef, canvasRef)}
          disabled={loading || !modelReady}
          className={`w-full py-3 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] ${
            loading || !modelReady
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg'
          }`}
        >
          {loading ? 'Processing...' : modelReady ? 'Capture & Detect Emotion' : 'Loading Model...'}
        </button>

        <ProgressBar progressItems={progressItems} />
        <EmotionResult emotion={emotion} score={score} />
      </div>
    </div>
  );
}