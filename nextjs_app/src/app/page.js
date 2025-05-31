'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import VideoCapture from '../components/VideoCapture';
import { useEmotionWorker } from '../hooks/useEmotionWorker';
import './page.css';

const HomePage = () => {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [videoStream, setVideoStream] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    loading: emotionLoading,
    modelReady,
    error: emotionError,
    captureAndClassify,
    setError: setEmotionError,
  } = useEmotionWorker();

  // Thiết lập video stream cho webcam
  useEffect(() => {
    const setupVideo = async () => {
      try {
        if (!videoStream && videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          });
          setVideoStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        } else if (videoStream && videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Lỗi video stream:', err);
        setEmotionError('Không thể truy cập webcam. Vui lòng kiểm tra quyền truy cập camera.');
      }
    };
    setupVideo();
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    };
  }, [videoRef, videoStream, setEmotionError]);

  // Xử lý khi người dùng submit từ
  const handleInputSubmit = async () => {
    if (inputValue.trim() && modelReady && !emotionLoading && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const emotionResult = await captureAndClassify(videoRef, canvasRef);
        if (emotionResult && emotionResult.emotion) {
          const emotion = emotionResult.emotion;
          router.push(`/feature?word=${encodeURIComponent(inputValue)}&emotion=${emotion}`);
        } else {
          setEmotionError('Không thể nhận diện cảm xúc. Vui lòng thử lại.');
        }
      } catch (error) {
        console.error('Lỗi nhận diện cảm xúc:', error);
        setEmotionError('Lỗi khi nhận diện cảm xúc. Vui lòng thử lại.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="homepage">
      <video autoPlay loop muted className="background-video">
        <source src="/bg.mp4" type="video/mp4" />
        Trình duyệt của bạn không hỗ trợ thẻ video.
      </video>
      {/* Webcam ở góc trái trên */}
      <div className="webcam-container">
        <VideoCapture videoRef={videoRef} canvasRef={canvasRef} onError={setEmotionError} />
      </div>
      {/* Nội dung chính */}
      <div className="selector-content">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Nhập từ của bạn"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
            disabled={!modelReady || isSubmitting}
          />
          <span className="input-icon" onClick={handleInputSubmit} tabIndex={0}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        {/* Thông báo lỗi */}
        {emotionError && (
          <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>
            {emotionError}
          </div>
        )}
        {/* Thông báo đang tải mô hình */}
        {!modelReady && (
          <div className="loading-message" >
            Đang tải mô hình nhận diện cảm xúc...
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;