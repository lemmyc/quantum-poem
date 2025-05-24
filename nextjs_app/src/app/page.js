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
  const [videoStream, setVideoStream] = useState(null);
  // const [keywords, setKeywords] = useState([]); // Vẫn giữ nếu bạn muốn hiển thị tất cả 10 từ đâu đó
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  
  // State mới cho từ và xác suất
  const [isFetchingProbabilities, setIsFetchingProbabilities] = useState(false);
  const [displayableWords, setDisplayableWords] = useState([]); // [{ word: string, isInput: boolean, probability?: number }]

  const {
    loading: emotionLoading,
    modelReady,
    error,
    progressItems,
    captureAndClassify,
    setError
  } = useEmotionWorker();

  useEffect(() => {
    const setupVideo = async () => {
      try {
        if (!videoStream && videoRef.current) {
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
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Video stream error:', err);
        setError('Failed to access webcam. Please ensure camera permissions are granted.');
      }
    };

    setupVideo();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    };
  }, [videoRef, videoStream, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || emotionLoading || !modelReady || isGeneratingKeywords || isFetchingProbabilities) return;
    
    setError(null);
    // setKeywords([]); // Reset nếu bạn dùng state này
    setResult(null);
    setDisplayableWords([]); // Reset từ hiển thị

    try {
      if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
        setError('Video stream is not available. Please reload the page.');
        return;
      }

      if (videoRef.current.paused) {
        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Failed to play video:', err);
        }
      }
      
      const emotionResult = await captureAndClassify(videoRef, canvasRef);
      
      if (!emotionResult || !emotionResult.emotion) {
        setError('Failed to detect emotion. Please try again.');
        return;
      }

      setIsGeneratingKeywords(true);
      let generatedKeywords = [];
      try {
        const keywordsResponse = await fetch('/api/generateKeywords', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputText: inputText,
            emotion: emotionResult.emotion,
          }),
        });

        if (!keywordsResponse.ok) {
          const errorData = await keywordsResponse.json();
          throw new Error(errorData.error || 'Failed to generate keywords from API');
        }
        const keywordsData = await keywordsResponse.json();
        generatedKeywords = keywordsData.keywords || [];
        // setKeywords(generatedKeywords); // Cập nhật nếu bạn dùng state này

        if (generatedKeywords.length > 0) {
          setIsFetchingProbabilities(true);
          try {
            const probResponse = await fetch('/api/getWordProbabilities', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ keywords: generatedKeywords }),
            });

            if (!probResponse.ok) {
              const probErrorData = await probResponse.json();
              throw new Error(probErrorData.error || 'Failed to get word probabilities');
            }
            const probData = await probResponse.json();
            
            const sortedWordsWithProb = (probData.results || [])
              .sort((a, b) => b.probability - a.probability)
              .slice(0, 5)
              .map(item => ({ word: item.word, isInput: false, probability: item.probability }));

            setDisplayableWords([
              { word: inputText, isInput: true },
              ...sortedWordsWithProb
            ]);

          } catch (probError) {
            console.error('Probabilities fetching error:', probError);
            setError(`Failed to get word probabilities: ${probError.message}. Keywords were generated: ${generatedKeywords.join(', ')}`);
            // Hiển thị input và 10 từ đã gen nếu API xác suất lỗi
            setDisplayableWords([
              { word: inputText, isInput: true },
              ...generatedKeywords.map(kw => ({ word: kw, isInput: false })) // Không có xác suất
            ]);
          } finally {
            setIsFetchingProbabilities(false);
          }
        } else {
          // Không có từ nào được tạo, chỉ hiển thị input
          setDisplayableWords([{ word: inputText, isInput: true }]);
          setError(`Keywords generation returned empty. Emotion: ${emotionResult.emotion}`);
        }

      } catch (keywordsError) {
        console.error('Keywords generation error:', keywordsError);
        setError(`Failed to generate keywords: ${keywordsError.message}. Emotion detected: ${emotionResult.emotion}`);
        setDisplayableWords([{ word: inputText, isInput: true }]); // Hiển thị input nếu gen keywords lỗi
      } finally {
        setIsGeneratingKeywords(false);
      }
      
      setResult({
        input: inputText,
        emotion: emotionResult.emotion,
        score: emotionResult.score,
        generatedKeywords: generatedKeywords, // Lưu tất cả 10 từ (hoặc ít hơn nếu API trả về vậy)
        // topWords: displayableWords.filter(dw => !dw.isInput).map(dw => dw.word) // Có thể thêm vào result nếu muốn
      });

    } catch (err) {
      console.error('Submit error:', err);
      setError(typeof err === 'string' ? err : 'Failed to process. Please try again.');
    }
  };

  const handleWordClick = (word) => {
    console.log("Selected word:", word);
  };

  const isLoading = emotionLoading || isGeneratingKeywords || isFetchingProbabilities;

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
        
        <div className="hidden"> {/* Giữ video ẩn theo thiết kế ban đầu */}
          <VideoCapture
            videoRef={videoRef}
            canvasRef={canvasRef}
            onError={setError}
          />
        </div>

        <ProgressBar progressItems={progressItems} />
        
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-4">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter your text here..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              disabled={!modelReady || isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !modelReady || !inputText.trim()}
            className={`w-full py-3 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] ${
              isLoading || !modelReady || !inputText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg'
            }`}
          >
            {emotionLoading ? 'Detecting Emotion...' : 
             isGeneratingKeywords ? 'Generating Keywords...' : 
             isFetchingProbabilities ? 'Analyzing Keywords...' : // Trạng thái mới
             modelReady ? 'Submit' : 'Loading Model...'}
          </button>
        </form>
        
        {/* Hiển thị các từ có thể chọn */}
        {displayableWords.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {displayableWords.some(dw => !dw.isInput) ? "Tap a word to select:" : "Your Input:"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {displayableWords.map((item, index) => (
                <button
                  key={`${item.word}-${index}`} // Key tốt hơn
                  onClick={() => handleWordClick(item.word)}
                  title={item.isInput ? "Your original input" : `Suggested word (Probability: ${item.probability ? (item.probability * 100).toFixed(0) + '%' : 'N/A'})`}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${item.isInput 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300 shadow-sm' 
                      : 'bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-300 shadow-sm'}
                  `}
                >
                  {item.word}
                  {!item.isInput && item.probability && (
                    <span className="ml-1 text-xs opacity-60">({(item.probability * 100).toFixed(0)}%)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hiển thị kết quả JSON (có thể giữ lại hoặc loại bỏ tùy ý) */}
        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">Raw Result Data:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-x-auto">
              <pre className="text-gray-800 font-mono text-sm whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}