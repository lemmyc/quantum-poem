import { useRef, useState, useEffect } from 'react';

export function useEmotionWorker() {
  const workerRef = useRef(null);
  const [emotion, setEmotion] = useState(null);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState(null);
  const [progressItems, setProgressItems] = useState([]);

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessageReceived = (e) => {
      console.log('Worker message:', e.data);

      switch (e.data.status) {
        case 'initiate':
          setModelReady(false);
          setProgressItems(prev => [...prev, e.data]);
          break;
        case 'progress':
          setProgressItems(prev => prev.map(item => {
            if (item.file === e.data.file) {
              return { ...item, progress: e.data.progress }
            }
            return item;
          }));
          break;
        case 'done':
          setProgressItems(prev =>
            prev.filter(item => item.file !== e.data.file)
          );
          break;
        case 'ready':
          setModelReady(true);
          break;
        case 'complete':
          setEmotion(e.data.output[0].label);
          setScore(e.data.output[0].score.toFixed(4));
          setLoading(false);
          break;
        case 'error':
          setError(`Error: ${e.data.error}`);
          setLoading(false);
          setProgressItems([]);
          break;
      }
    };

    workerRef.current.addEventListener('message', onMessageReceived);
    workerRef.current.postMessage({ status: 'initiate' });

    return () => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', onMessageReceived);
      }
    };
  }, []);

  const captureAndClassify = async (videoRef, canvasRef) => {
    if (!modelReady || !videoRef.current || !canvasRef.current) {
      setError('Model or webcam not ready.');
      return;
    }

    setLoading(true);
    setError(null);
    setEmotion(null);
    setScore(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    workerRef.current.postMessage({ image: dataUrl });
  };

  return {
    emotion,
    score,
    loading,
    modelReady,
    error,
    progressItems,
    captureAndClassify,
    setError
  };
} 