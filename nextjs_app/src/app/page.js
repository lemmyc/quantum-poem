'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import VideoCapture from '../components/VideoCapture';
import ProgressBar from '../components/ProgressBar';
import { useEmotionWorker } from '../hooks/useEmotionWorker';

// Mock function to detect language (keep as is)
const detectLanguage = async (text) => {
  console.log(`Detecting language for: \"${text}\"`);
  if (/[àáạảãâầấậẩẫăằắặẳẵđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i.test(text)) {
    return 'vietnamese';
  }
  if (/[一-龯ぁ-んァ-ン]/.test(text)) {
    return 'japanese';
  }
  return 'english';
};

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [videoStream, setVideoStream] = useState(null);

  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isFetchingProbabilities, setIsFetchingProbabilities] = useState(false);
  const [displayableWords, setDisplayableWords] = useState([]);

  const [currentPoemInputWord, setCurrentPoemInputWord] = useState(null);
  const [isGeneratingPoem, setIsGeneratingPoem] = useState(false);
  const [poem, setPoem] = useState(null);
  const [poemError, setPoemError] = useState(null);
  const [poemLanguage, setPoemLanguage] = useState(null);

  const {
    loading: emotionLoading,
    modelReady,
    error: mainError,
    progressItems,
    captureAndClassify,
    setError: setMainError
  } = useEmotionWorker();

  useEffect(() => {
    const setupVideo = async () => {
      try {
        if (!videoStream && videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
          });
          setVideoStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        } else if (videoStream && videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Video stream error:', err);
        setMainError('Cannot access webcam. Please ensure camera permissions are granted.');
      }
    };
    setupVideo();
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    };
  }, [videoRef, videoStream, setMainError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || !modelReady) return;

    setMainError(null); setPoem(null); setPoemError(null); setPoemLanguage(null);
    setCurrentPoemInputWord(null); setResult(null); setDisplayableWords([]);

    try {
      if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
        setMainError('Video stream not available. Please refresh the page.');
        return;
      }
      if (videoRef.current.paused) await videoRef.current.play().catch(err => console.error('Failed to play video:', err));

      const emotionResult = await captureAndClassify(videoRef, canvasRef);
      if (!emotionResult || !emotionResult.emotion) {
        setMainError('Unable to detect emotion. Please try again.');
        return;
      }

      setIsGeneratingKeywords(true);
      let generatedKeywords = [];
      try {
        const keywordsResponse = await fetch('/api/generateKeywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputText: inputText, emotion: emotionResult.emotion }),
        });
        if (!keywordsResponse.ok) throw new Error((await keywordsResponse.json()).error || 'Unable to generate keywords');
        const keywordsData = await keywordsResponse.json();
        generatedKeywords = keywordsData.keywords || [];

        if (generatedKeywords.length > 0) {
          setIsFetchingProbabilities(true);
          try {
            const probResponse = await fetch('/api/getWordProbabilities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keywords: generatedKeywords }),
            });
            if (!probResponse.ok) throw new Error((await probResponse.json()).error || 'Unable to get keyword probabilities');
            const probData = await probResponse.json();
            const sortedWordsWithProb = (probData.results || [])
              .sort((a, b) => b.probability - a.probability)
              .slice(0, 5)
              .map(item => ({ word: item.word, isInput: false, probability: item.probability }));
            setDisplayableWords([{ word: inputText, isInput: true }, ...sortedWordsWithProb]);
          } catch (probError) {
            console.error('Probability error:', probError);
            setMainError(`Probability error: ${probError.message}. Keywords: ${generatedKeywords.join(', ')}`);
            setDisplayableWords([{ word: inputText, isInput: true }, ...generatedKeywords.map(kw => ({ word: kw, isInput: false, probability: undefined }))]);
          } finally {
            setIsFetchingProbabilities(false);
          }
        } else {
          setDisplayableWords([{ word: inputText, isInput: true }]);
          setMainError(`No keywords were generated. Emotion: ${emotionResult.emotion}`);
        }
      } catch (keywordsError) {
        console.error('Keyword generation error:', keywordsError);
        setMainError(`Keyword generation error: ${keywordsError.message}. Emotion: ${emotionResult.emotion}`);
        setDisplayableWords([{ word: inputText, isInput: true }]);
      } finally {
        setIsGeneratingKeywords(false);
      }

      setResult({
        input: inputText,
        emotion: emotionResult.emotion,
        score: emotionResult.score,
        generatedKeywords: generatedKeywords,
      });

    } catch (err) {
      console.error('Submit error:', err);
      setMainError(typeof err === 'string' ? err : 'Processing failed. Please try again.');
    }
  };

  const handleWordSelectionForPoem = useCallback(async (selectedWordObject) => {
    if (emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || !modelReady) return;

    const selectedWord = selectedWordObject.word;
    setCurrentPoemInputWord(selectedWord);
    setPoem(null); setPoemError(null); setPoemLanguage(null); 
    setMainError(null); 

    setIsGeneratingPoem(true);
    let tempLoadingMessage = "";

    try {
      tempLoadingMessage = "Detecting new emotion for poem..."; setMainError(tempLoadingMessage);
      if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
        throw new Error('Video stream not available for new emotion detection.');
      }
      if (videoRef.current.paused) await videoRef.current.play().catch(err => console.warn('Unable to play video:', err));
      
      const newEmotionResult = await captureAndClassify(videoRef, canvasRef);
      if (!newEmotionResult || !newEmotionResult.emotion) {
        throw new Error('Unable to detect new emotion for poem.');
      }
      const newEmotion = newEmotionResult.emotion;
      
      tempLoadingMessage = "Detecting poem language..."; setMainError(tempLoadingMessage);
      const language = await detectLanguage(selectedWord);
      setPoemLanguage(language);
      
      setMainError(`Composing ${language} poem...`);

      const poemApiResponse = await fetch('/api/generatePoem', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainWord: selectedWord,
          emotion: newEmotion, 
          language: language
        }),
      });

      if (!poemApiResponse.ok) {
        const errorData = await poemApiResponse.json();
        throw new Error(errorData.error || 'Unable to generate poem from API.');
      }
      
      const poemData = await poemApiResponse.json();
      setPoem(poemData.poem);
      setMainError(null); 

    } catch (error) {
      console.error("Error in poem generation process:", error);
      setPoemError(error.message || "An error occurred while generating the poem.");
      setPoem(null); 
      setMainError(null);
    } finally {
      setIsGeneratingPoem(false);
    }
  }, [
    modelReady, captureAndClassify, videoRef, canvasRef, 
    emotionLoading, isGeneratingKeywords, isFetchingProbabilities, isGeneratingPoem,
    setMainError, setPoem, setPoemError, setPoemLanguage, setCurrentPoemInputWord, setIsGeneratingPoem
  ]);

  const handlePoemLineRegeneration = useCallback(async (lineText) => {
    // Prevent if another task is running or model is not ready
    if (emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || !modelReady) return;

    // Reset previous result states
    setMainError(null);
    setPoem(null);
    setPoemError(null);
    setPoemLanguage(null);
    setCurrentPoemInputWord(lineText); // Save selected line as inspiration
    setDisplayableWords([]); // Clean up this state in case it's used elsewhere
    setResult(null);        

    setIsGeneratingPoem(true); // Mark start of new poem generation process (including intermediate steps)
    let tempLoadingMessageForMainError = "";

    try {
        tempLoadingMessageForMainError = "Detecting emotion again...";
        setMainError(tempLoadingMessageForMainError);

        // 1. Detect new emotion
        if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
            throw new Error('Video stream not available for new emotion detection.');
        }
        if (videoRef.current.paused) {
            await videoRef.current.play().catch(err => console.warn('Unable to play video for emotion detection:', err));
        }

        const newEmotionResult = await captureAndClassify(videoRef, canvasRef);
        if (!newEmotionResult || !newEmotionResult.emotion) {
            throw new Error('Unable to detect new emotion for poem generation.');
        }
        const newEmotion = newEmotionResult.emotion;

        // 2. Generate keywords from selected line and new emotion
        tempLoadingMessageForMainError = `Generating keywords from line: "${lineText.substring(0, 30)}${lineText.length > 30 ? '...' : ''}"...`;
        setMainError(tempLoadingMessageForMainError);

        let mainWordForNewPoem = lineText; // Default if subsequent steps fail
        let newGeneratedKeywords = [];

        const keywordsResponse = await fetch('/api/generateKeywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputText: lineText, emotion: newEmotion }),
        });

        if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            newGeneratedKeywords = keywordsData.keywords || [];

            if (newGeneratedKeywords.length > 0) {
                mainWordForNewPoem = newGeneratedKeywords[0]; // Fallback if probability fetch fails

                // 3. Get probabilities for new keywords
                tempLoadingMessageForMainError = "Analyzing new keywords...";
                setMainError(tempLoadingMessageForMainError);

                const probResponse = await fetch('/api/getWordProbabilities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords: newGeneratedKeywords }),
                });

                if (probResponse.ok) {
                    const probData = await probResponse.json();
                    const sortedWordsWithProb = (probData.results || [])
                        .sort((a, b) => b.probability - a.probability);
                    
                    if (sortedWordsWithProb.length > 0) {
                        mainWordForNewPoem = sortedWordsWithProb[0].word; // AUTO-SELECT HIGHEST PROBABILITY WORD
                        console.log("Auto-selected word:", mainWordForNewPoem, "with probability:", sortedWordsWithProb[0].probability);
                    } else {
                        console.warn('No words returned with probabilities. Using first keyword:', mainWordForNewPoem);
                    }
                } else {
                    console.warn('Unable to get new keyword probabilities. Using first generated keyword:', mainWordForNewPoem);
                }
            } else {
                 console.warn('No new keywords generated from line. Using original line as main input:', mainWordForNewPoem);
            }
        } else {
             console.warn('Keyword generation API failed. Using entire line as main input:', mainWordForNewPoem);
        }
        
        // No need to update displayableWords to show to user at this step anymore.

        // 4. Generate new poem (previously step 5)
        const language = await detectLanguage(mainWordForNewPoem);
        setPoemLanguage(language);

        tempLoadingMessageForMainError = `Composing new ${language} poem inspired by "${mainWordForNewPoem.substring(0,30)}${mainWordForNewPoem.length > 30 ? '...' : ''}"...`;
        setMainError(tempLoadingMessageForMainError);

        const poemApiResponse = await fetch('/api/generatePoem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mainWord: mainWordForNewPoem,
                emotion: newEmotion,
                language: language
            }),
        });

        if (!poemApiResponse.ok) {
            const errorData = await poemApiResponse.json();
            throw new Error(errorData.error || 'Unable to generate new poem from API.');
        }

        const poemData = await poemApiResponse.json();
        setPoem(poemData.poem); // Display new poem
        setMainError(null); // Clear loading message on success

    } catch (error) {
        console.error("Error in poem regeneration process from line:", error);
        setPoemError(error.message || "An unknown error occurred while regenerating the poem.");
        setPoem(null);
        setMainError(null); 
    } finally {
        setIsGeneratingPoem(false); // Mark end of process
    }
  }, [
      modelReady, captureAndClassify, videoRef, canvasRef,
      emotionLoading, isGeneratingKeywords, isFetchingProbabilities, isGeneratingPoem,
      setMainError, setPoem, setPoemError, setPoemLanguage, setCurrentPoemInputWord,
      setDisplayableWords, setResult, setIsGeneratingPoem,
  ]);

  const overallLoading = emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem;

  let buttonText = 'Generate Ideas';
  if (!modelReady) buttonText = 'Loading Model...';
  else if (emotionLoading) buttonText = 'Detecting Emotion...';
  else if (isGeneratingKeywords) buttonText = 'Generating Keywords...';
  else if (isFetchingProbabilities) buttonText = 'Analyzing Keywords...';
  else if (isGeneratingPoem) {
     buttonText = currentPoemInputWord ? `Composing poem about "${currentPoemInputWord.substring(0,20)}..."` : 'Composing poem...';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-indigo-800 tracking-tight">Quantum Poem</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 hover:shadow-2xl">
        {(mainError || poemError) && (
          <div className={`p-4 mb-6 rounded border-l-4 ${poemError ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'}`}>
            {mainError && <p className={`font-medium ${poemError ? 'text-red-700' : 'text-yellow-700'}`}>{mainError}</p>}
            {poemError && <p className="text-red-700 mt-1 font-medium">{poemError}</p>}
            <button
              onClick={() => { setMainError(null); setPoemError(null); }}
              className={`text-sm underline mt-1 ${poemError ? 'text-red-600' : 'text-yellow-600'}`}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="hidden">
          <VideoCapture videoRef={videoRef} canvasRef={canvasRef} onError={setMainError} />
        </div>

        <ProgressBar progressItems={progressItems} />

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-4">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter your initial idea..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              disabled={!modelReady || overallLoading}
            />
          </div>
          <button
            type="submit"
            disabled={overallLoading || !modelReady || !inputText.trim()}
            className={`w-full py-3 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] ${(overallLoading || !modelReady || !inputText.trim())
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg'
              }`}
          >
            {buttonText}
          </button>
        </form>

        {displayableWords.length > 0 && !poem && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {displayableWords.some(dw => !dw.isInput) ? "Or, select a word to compose a poem:" : "Your idea:"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {displayableWords.map((item, index) => (
                <button
                  key={`${item.word}-${index}-${item.isInput}`}
                  onClick={() => {
                    if (item.isInput && displayableWords.length === 1 && !displayableWords.some(dw => !dw.isInput)) return; 
                    handleWordSelectionForPoem(item);
                  }}
                  title={item.isInput && displayableWords.length === 1 && !displayableWords.some(dw => !dw.isInput) ? "Your original idea" : `Use word "${item.word}" to compose a poem ${item.probability ? `(Probability: ${(item.probability * 100).toFixed(0)}%)` : ''}`}
                  disabled={overallLoading || (item.isInput && displayableWords.length === 1 && !displayableWords.some(dw => !dw.isInput))}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm
                    ${(overallLoading || (item.isInput && displayableWords.length === 1 && !displayableWords.some(dw => !dw.isInput))) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                      item.isInput
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300'
                        : 'bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-300'}
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
        
        {/* isGeneratingPoem notification is integrated into buttonText and mainError */}

        {poem && (
          <div className="mt-8 p-6 bg-indigo-50 rounded-xl shadow-lg border border-indigo-200">
            <h3 className="text-2xl font-semibold mb-4 text-indigo-700 text-center">
              Your Poem{currentPoemInputWord ? ` (inspired by \"${currentPoemInputWord.substring(0, 50)}${currentPoemInputWord.length > 50 ? '...' : ''}\")` : ''}
              {poemLanguage ? <span className="text-sm block text-indigo-500">Language: {poemLanguage}</span> : ''}
            </h3>
            <div className="text-gray-800 leading-relaxed text-center font-serif text-lg">
              {poem.split('\n').map((line, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (line.trim()) { // Only allow selection of non-empty lines
                       handlePoemLineRegeneration(line.trim())
                    }
                  }}
                  disabled={overallLoading || !line.trim()}
                  className={`block w-full text-left p-1 my-0.5 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-indigo-300
                    ${!line.trim() ? 'cursor-default h-4' : // Empty lines will not be clickable and have fixed height
                      overallLoading ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-indigo-200 cursor-pointer'}
                  `}
                  title={line.trim() ? "Select this line to generate a new poem" : ""}
                >
                  {line.trim() ? line : <> </>}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setPoem(null); setCurrentPoemInputWord(null); setPoemError(null);
                setPoemLanguage(null); setMainError(null);
                setDisplayableWords([]);
                setInputText(''); 
              }}
              className="mt-6 w-full py-2 px-4 rounded-lg text-indigo-700 font-semibold bg-indigo-100 hover:bg-indigo-200 transition-colors"
            >
              Create Another / Enter New Idea
            </button>
          </div>
        )}

        {result && !poem && ( 
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">Raw Idea Data:</h3>
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