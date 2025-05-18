import { useRef, useState, useEffect } from 'react';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

export function useEmotionWorker() {
  const workerRef = useRef(null);
  const faceDetectorRef = useRef(null); // Stores the FaceDetector instance
  const [emotion, setEmotion] = useState(null);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState(null);
  const [progressItems, setProgressItems] = useState([]);

  // Initialize the worker and MediaPipe FaceDetector
  useEffect(() => {
    // Initialize Web Worker
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../worker.js', import.meta.url), {
        type: 'module'
      });
    }
    // Initialize FaceDetector
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
        );
        faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite'
          },
          runningMode: 'IMAGE'
        });
        setModelReady(true);
      } catch (e) {
        setError('Could not load FaceDetector: ' + e.message);
      }
    })();

    // Listen for messages from the worker
    const onMessageReceived = (e) => {
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

  // Detect face, crop, resize, grayscale, and send to worker
  const captureAndClassify = async (videoRef, canvasRef) => {
    if (!modelReady || !videoRef.current || !canvasRef.current) {
      setError('Model or webcam not ready.');
      return;
    }
    setLoading(true);
    setError(null);
    setEmotion(null);
    setScore(null);

    const video = videoRef.current;
    const fullCanvas = canvasRef.current;
    const fullCtx = fullCanvas.getContext('2d');
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

    const imgBitmap = await createImageBitmap(fullCanvas);

    const result = faceDetectorRef.current.detect(imgBitmap);
    if (!result.detections || result.detections.length === 0) {
      setError('No faces detected.');
      setLoading(false);
      return;
    }

    const { boundingBox } = result.detections[0]; // { originX, originY, width, height } in pixels

    const cropX = Math.round(boundingBox.originX);
    const cropY = Math.round(boundingBox.originY);
    const cropW = Math.round(boundingBox.width);
    const cropH = Math.round(boundingBox.height);

    if (cropW <= 0 || cropH <= 0) {
      setError('Detected face has invalid dimensions (width or height <= 0).');
      setLoading(false);
      return;
    }

    const adjustedCropX = Math.max(0, cropX);
    const adjustedCropY = Math.max(0, cropY);
    const adjustedCropW = Math.min(cropW, fullCanvas.width - adjustedCropX);
    const adjustedCropH = Math.min(cropH, fullCanvas.height - adjustedCropY);

    if (adjustedCropW <= 0 || adjustedCropH <= 0) {
      setError('Adjusted crop dimensions are invalid.');
      setLoading(false);
      return;
    }
    
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    cropCanvas.width = adjustedCropW;
    cropCanvas.height = adjustedCropH;

    cropCtx.drawImage(
      fullCanvas,
      adjustedCropX, adjustedCropY, adjustedCropW, adjustedCropH, 
      0, 0, adjustedCropW, adjustedCropH
    );

    // Resize to 48x48 and convert to grayscale
    const processedCanvas = document.createElement('canvas');
    processedCanvas.width = 48;
    processedCanvas.height = 48;
    const processedCtx = processedCanvas.getContext('2d');

    processedCtx.drawImage(cropCanvas, 0, 0, adjustedCropW, adjustedCropH, 0, 0, 48, 48);

    const imageData = processedCtx.getImageData(0, 0, 48, 48);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b; // Luminosity formula
      data[i] = gray;     // Red
      data[i + 1] = gray; // Green
      data[i + 2] = gray; // Blue
      // Alpha (data[i+3]) remains unchanged
    }
    processedCtx.putImageData(imageData, 0, 0);

    // Convert the 48x48 grayscale canvas to dataURL and send to worker
    const faceDataUrl = processedCanvas.toDataURL('image/png');
    workerRef.current.postMessage({ image: faceDataUrl });
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

