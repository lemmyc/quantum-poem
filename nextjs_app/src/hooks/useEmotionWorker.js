import { useRef, useState, useEffect, useCallback } from 'react';
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
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.2  // Lower detection confidence threshold
        });
        setModelReady(true);
      } catch (e) {
        setError('Could not load FaceDetector: ' + e.message);
        console.error('FaceDetector error:', e);
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
          console.error('Worker error:', e.data.error);
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
  const captureAndClassify = useCallback(async (videoRef, canvasRef) => {
    if (!modelReady) {
      const errorMsg = 'Model chưa sẵn sàng.';
      console.error(errorMsg);
      setError(errorMsg);
      return Promise.reject(errorMsg);
    }
    
    if (!videoRef.current || !canvasRef.current) {
      const errorMsg = 'Video hoặc canvas không sẵn sàng.';
      console.error(errorMsg);
      setError(errorMsg);
      return Promise.reject(errorMsg);
    }

    // Check if video is ready
    const video = videoRef.current;
    if (!video.srcObject || video.srcObject.getVideoTracks().length === 0) {
      const errorMsg = 'Video stream không khả dụng.';
      console.error(errorMsg);
      setError(errorMsg);
      return Promise.reject(errorMsg);
    }
    
    if (video.readyState < 2) {
      // Wait for video to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            requestAnimationFrame(checkReady);
          }
        };
        checkReady();
      });
    }
    
    setLoading(true);
    setError(null);
    setEmotion(null);
    setScore(null);

    try {
      const fullCanvas = canvasRef.current;
      const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
      
      fullCanvas.width = video.videoWidth || 640;
      fullCanvas.height = video.videoHeight || 480;
      
      // Force a fresh frame capture
      fullCtx.clearRect(0, 0, fullCanvas.width, fullCanvas.height);
      fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

      console.log('Video dimensions for face detection:', video.videoWidth, 'x', video.videoHeight);
      console.log('Canvas dimensions for face detection:', fullCanvas.width, 'x', fullCanvas.height);
      
      const imgBitmap = await createImageBitmap(fullCanvas);
      console.log('Created ImageBitmap of size:', imgBitmap.width, 'x', imgBitmap.height);

      // Use a higher min score threshold for detection
      const result = faceDetectorRef.current.detect(imgBitmap);
      console.log('Face detection result:', result);
      
      if (!result.detections || result.detections.length === 0) {
        const errorMsg = 'Không phát hiện được khuôn mặt. Vui lòng đảm bảo khuôn mặt bạn hiển thị rõ trong camera.';
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return Promise.reject(errorMsg);
      }

      const { boundingBox } = result.detections[0]; // { originX, originY, width, height } in pixels
      console.log('Face bounding box:', boundingBox);

      const cropX = Math.round(boundingBox.originX);
      const cropY = Math.round(boundingBox.originY);
      const cropW = Math.round(boundingBox.width);
      const cropH = Math.round(boundingBox.height);

      if (cropW <= 0 || cropH <= 0) {
        const errorMsg = 'Kích thước khuôn mặt phát hiện không hợp lệ.';
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return Promise.reject(errorMsg);
      }

      const adjustedCropX = Math.max(0, cropX);
      const adjustedCropY = Math.max(0, cropY);
      const adjustedCropW = Math.min(cropW, fullCanvas.width - adjustedCropX);
      const adjustedCropH = Math.min(cropH, fullCanvas.height - adjustedCropY);

      if (adjustedCropW <= 0 || adjustedCropH <= 0) {
        const errorMsg = 'Kích thước cắt không hợp lệ.';
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return Promise.reject(errorMsg);
      }
      
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
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
      const processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });

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
      console.log('Sending face data to worker');
      
      // Send to worker and wait for response
      return new Promise((resolve, reject) => {
        const messageListener = (e) => {
          if (e.data.status === 'complete') {
            console.log('Received emotion result:', e.data.output);
            workerRef.current.removeEventListener('message', messageListener);
            resolve({
              emotion: e.data.output[0].label,
              score: e.data.output[0].score.toFixed(4)
            });
          } else if (e.data.status === 'error') {
            console.error('Emotion detection error:', e.data.error);
            workerRef.current.removeEventListener('message', messageListener);
            reject(e.data.error);
          }
        };
        
        workerRef.current.addEventListener('message', messageListener);
        workerRef.current.postMessage({ image: faceDataUrl });
      });
    } catch (err) {
      console.error('Face detection error:', err);
      setError('Lỗi trong quá trình phát hiện khuôn mặt: ' + err.message);
      setLoading(false);
      return Promise.reject(err);
    }
  }, [modelReady]);

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

