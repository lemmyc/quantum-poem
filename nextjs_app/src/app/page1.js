// src\app\page.js

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import VideoCapture from '../components/VideoCapture';
import ProgressBar from '../components/ProgressBar';
import { useEmotionWorker } from '../hooks/useEmotionWorker';

// Mock function to detect language (keep as is)
const detectLanguage = async (text) => {
  // console.log(`Detecting language for: \"${text}\"`);
  if (/[àáạảãâầấậẩẫăằắặẳẵđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i.test(text)) {
    return 'vietnamese';
  }
  if (/[一-龯ぁ-んァ-ン]/.test(text)) {
    return 'japanese';
  }
  return 'english';
};

const INTERACTION_INTERVAL = 10000; // 5 seconds for word choice
const NEW_KEYWORDS_TIMEOUT = 20000; // 10 seconds for current set of keywords before regenerating

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null); // For raw data display
  const [videoStream, setVideoStream] = useState(null);

  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isFetchingProbabilities, setIsFetchingProbabilities] = useState(false);
  
  // States for the new interactive flow
  const [top5Keywords, setTop5Keywords] = useState([]); // {word, probability} list
  const [activeWordCandidate, setActiveWordCandidate] = useState(null); // {word, probability}
  const [showCandidateOptions, setShowCandidateOptions] = useState(false);
  const [failedSuggestionCycles, setFailedSuggestionCycles] = useState(0); // 0 or 1
  const [isFindingRelevantWord, setIsFindingRelevantWord] = useState(false); // Loading for suggestion step
  const [previouslyRejectedWordInCycle, setPreviouslyRejectedWordInCycle] = useState(null); // NEW STATE

  const wordSuggestionTimeoutRef = useRef(null);
  const newKeywordsCycleTimeoutRef = useRef(null);

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
      clearTimeout(wordSuggestionTimeoutRef.current);
      clearTimeout(newKeywordsCycleTimeoutRef.current);
    };
  }, [videoRef, videoStream, setMainError]);


  const processAndSuggestWordFromList = useCallback(async (currentWordList) => {
    if (!currentWordList || currentWordList.length === 0 || isFindingRelevantWord || isGeneratingPoem || !modelReady || !videoRef.current) return;

    clearTimeout(wordSuggestionTimeoutRef.current);
    setIsFindingRelevantWord(true);
    setShowCandidateOptions(false);
    setActiveWordCandidate(null);
    setMainError(null); // Clear previous errors

    let wordsToSend = currentWordList.map(w => w.word);
    if (previouslyRejectedWordInCycle) {
      wordsToSend = wordsToSend.filter(word => word !== previouslyRejectedWordInCycle);
      console.log(`Excluding previously rejected word: "${previouslyRejectedWordInCycle}". Words to filter:`, wordsToSend);
    }

    if (wordsToSend.length === 0) {
        setMainError("No more words to suggest from the current list. Generating new keywords...");
        setIsFindingRelevantWord(false);
        setFailedSuggestionCycles(2); // Force new keyword generation by effectively ending this cycle
        return;
    }
    ////

    if (videoRef.current.paused) await videoRef.current.play().catch(err => console.warn('Failed to play video for emotion:', err));
    const emotionResult = await captureAndClassify(videoRef, canvasRef);
    if (!emotionResult || !emotionResult.emotion) {
      throw new Error('Unable to detect emotion for new keywords.');
    }

    const filterWordsByEmotionResponse = await fetch('/api/filterWordsByEmotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: wordsToSend, emotion: emotionResult.emotion }),
    });
    if (!filterWordsByEmotionResponse.ok) {
      const errorData = await filterWordsByEmotionResponse.json();
      throw new Error(errorData.error || 'Unable to generate new keywords.');
    }
    wordsToSend = await filterWordsByEmotionResponse.json();
    wordsToSend = wordsToSend.filteredWords;
    console.log("Filtered words:", wordsToSend);
    ////
    setMainError("Analyzing relevance of filtered words...");
    const probResponse = await fetch('/api/getWordProbabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: wordsToSend }),
    });
    if (!probResponse.ok) {
      const errorData = await probResponse.json();
      throw new Error(errorData.error || 'Failed to get probabilities for filtered words.');
    }
    const probData = await probResponse.json();

    if (!probData.results || probData.results.length === 0) {
      setMainError("No probabilities returned for filtered words. Trying next cycle...");
      setFailedSuggestionCycles(prev => prev + 1);
      setIsFindingRelevantWord(false);
      return;
    }

    const bestCandidate = probData.results.sort((a, b) => b.probability - a.probability)[0];
    console.log("bestCandidate", bestCandidate); // {word: 'lặng im', probability: 0.7987687809451185}
    setActiveWordCandidate(bestCandidate);
    setShowCandidateOptions(true);
    setIsFindingRelevantWord(false);
    setMainError(null); // Clear loading message
    console.log("processAndSuggestWordFromList", activeWordCandidate); //null
    wordSuggestionTimeoutRef.current = setTimeout(() => {
      handleSuggestionTimeoutOrNo(bestCandidate);
    }, INTERACTION_INTERVAL);

  }, [isFindingRelevantWord, isGeneratingPoem, modelReady, captureAndClassify, videoRef, canvasRef, setMainError, previouslyRejectedWordInCycle]);

  const initiateNewKeywordGeneration = useCallback(async (isInitialSubmit = false) => {
    if (isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || !modelReady || !videoRef.current) return;
    if (!inputText.trim() && !isInitialSubmit) { // isInitialSubmit allows empty inputText if called from handleSubmit directly
         // If not initial submit and inputText is empty, it means we are in a loop without a base.
         // This case should ideally not happen if handleSubmit ensures inputText.
         // For safety, if we are regenerating and inputText got cleared, use a generic seed.
         // However, current flow reuses original inputText.
    }

    console.log("Initiating new keyword generation. Reason:", isInitialSubmit ? "Initial Submit" : "Cycle reset or timeout");
    clearTimeout(wordSuggestionTimeoutRef.current);
    clearTimeout(newKeywordsCycleTimeoutRef.current);
    setActiveWordCandidate(null);
    setShowCandidateOptions(false);
    setTop5Keywords([]);
    setFailedSuggestionCycles(0);
    setPreviouslyRejectedWordInCycle(null); // RESET
    setResult(null); // Clear raw result display for new keywords
    if (!isInitialSubmit) setMainError("Generating a fresh set of keywords...");


    try {
      if (videoRef.current.paused) await videoRef.current.play().catch(err => console.warn('Failed to play video for emotion:', err));
      const emotionResult = await captureAndClassify(videoRef, canvasRef);
      if (!emotionResult || !emotionResult.emotion) {
        throw new Error('Unable to detect emotion for new keywords.');
      }
      if (!isInitialSubmit) setMainError(`Emotion detected: ${emotionResult.emotion}. Generating new keywords...`);


      setIsGeneratingKeywords(true);
      const keywordsResponse = await fetch('/api/generateKeywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: inputText, emotion: emotionResult.emotion }),
      });
      if (!keywordsResponse.ok) {
        const errorData = await keywordsResponse.json();
        throw new Error(errorData.error || 'Unable to generate new keywords.');
      }
      const { keywords: generatedKeywords } = await keywordsResponse.json();
      setIsGeneratingKeywords(false);

      setResult({ // Store raw result for debugging/display
        input: inputText,
        emotion: emotionResult.emotion,
        score: emotionResult.score,
        generatedKeywords: generatedKeywords,
      });

      if (!generatedKeywords || generatedKeywords.length === 0) {
        setMainError('No new keywords generated. Try a different input idea.');
        return;
      }
      
      if (!isInitialSubmit) setMainError("Analyzing new keywords...");
      setIsFetchingProbabilities(true);
      const probResponse = await fetch('/api/getWordProbabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: generatedKeywords }),
      });
      if (!probResponse.ok) {
        const errorData = await probResponse.json();
        throw new Error(errorData.error || 'Unable to get new keyword probabilities.');
      }
      const probData = await probResponse.json();
      setIsFetchingProbabilities(false);

      const newSortedWords = (probData.results || [])
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map(item => ({ word: item.word, probability: item.probability }));

      if (newSortedWords.length === 0) {
          setMainError("Could not determine relevant keywords from the generated list. Please try again.");
          return;
      }
      setTop5Keywords(newSortedWords); // This will trigger the useEffect to start the suggestion loop
      if (!isInitialSubmit) setMainError(null); // Clear loading message

    } catch (error) {
      console.error("Error in initiateNewKeywordGeneration:", error);
      setMainError(`Keyword Generation Error: ${error.message}`);
      setIsGeneratingKeywords(false);
      setIsFetchingProbabilities(false);
      setTop5Keywords([]); // Ensure no stale keywords on error
    }
  }, [
    inputText, isGeneratingKeywords, isFetchingProbabilities, isGeneratingPoem, modelReady,
    captureAndClassify, videoRef, canvasRef, setMainError, setIsGeneratingKeywords, setIsFetchingProbabilities
  ]);

  // Main useEffect to drive the interactive suggestion loop
  useEffect(() => {
    // Ensure all timeouts are cleared if the component unmounts or conditions change drastically
    return () => {
        clearTimeout(wordSuggestionTimeoutRef.current);
        clearTimeout(newKeywordsCycleTimeoutRef.current);
    };
  }, []);


  useEffect(() => {
    if (top5Keywords.length > 0 && !isGeneratingPoem && !activeWordCandidate && !isFindingRelevantWord) {
        clearTimeout(newKeywordsCycleTimeoutRef.current); // Clear previous overall timer before starting new logic

        if (failedSuggestionCycles < 2) {
            // Start the 10-second overall timeout for this set of top5Keywords
            // This timer ensures that if 2 suggestion cycles (each up to 5s + processing) don't result in a choice,
            // or if user is idle for 10s total with this keyword set, we regenerate.
            console.log(`Starting ${NEW_KEYWORDS_TIMEOUT/1000}s timer for current keyword set. Attempt ${failedSuggestionCycles + 1}.`);
            newKeywordsCycleTimeoutRef.current = setTimeout(() => {
                console.log(`${NEW_KEYWORDS_TIMEOUT/1000}s TIMEOUT for keyword set reached. Regenerating keywords.`);
                initiateNewKeywordGeneration(false);
            }, NEW_KEYWORDS_TIMEOUT);

            // Automatically trigger the suggestion process
            processAndSuggestWordFromList(top5Keywords);
        } else { // failedSuggestionCycles is 2 or more
            console.log("Max failed suggestion cycles reached. Regenerating keywords.");
            initiateNewKeywordGeneration(false); // Force regenerate new keywords
        }
    } else if (top5Keywords.length === 0 && !isGeneratingPoem && !activeWordCandidate && !isFindingRelevantWord && !isGeneratingKeywords && !isFetchingProbabilities && inputText) {
        // This condition might occur if everything is reset and inputText is still there, waiting for a submit.
        // Or if initiateNewKeywordGeneration failed to produce top5Keywords.
        // console.log("No top5Keywords, not busy, and inputText exists. Ready for submit or error state.");
    }

    // Cleanup for this specific effect instance
    // The global cleanup in the empty dependency array useEffect handles unmount.
    // This one handles re-runs if, for example, isGeneratingPoem becomes true.
    return () => {
        clearTimeout(newKeywordsCycleTimeoutRef.current);
    };
  }, [top5Keywords, failedSuggestionCycles, isGeneratingPoem, activeWordCandidate, isFindingRelevantWord, processAndSuggestWordFromList, initiateNewKeywordGeneration, inputText]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || isFindingRelevantWord || !modelReady) return;

    setMainError(null); setPoem(null); setPoemError(null); setPoemLanguage(null);
    setCurrentPoemInputWord(null);
    // Reset interactive flow states
    setTop5Keywords([]);
    setActiveWordCandidate(null);
    setShowCandidateOptions(false);
    setFailedSuggestionCycles(0);
    clearTimeout(wordSuggestionTimeoutRef.current);
    clearTimeout(newKeywordsCycleTimeoutRef.current);
    
    // Initial generation of keywords
    initiateNewKeywordGeneration(true); // Pass true for initial submit context
  };

  const handleSuggestionAccepted = () => {
    clearTimeout(wordSuggestionTimeoutRef.current);
    clearTimeout(newKeywordsCycleTimeoutRef.current); // Stop 10s overall timer as a choice is made
    
    const wordObjectToUse = activeWordCandidate; // {word, probability}
    
    setShowCandidateOptions(false);
    setActiveWordCandidate(null);
    setTop5Keywords([]); // Clear keywords as we are moving to poem
    setFailedSuggestionCycles(0); // Reset cycles

    if (wordObjectToUse && wordObjectToUse.word) {
      handleWordSelectionForPoem({ word: wordObjectToUse.word, isInput: false }); // Match structure if needed
    } else {
      setMainError("Error: No word was selected for the poem.");
    }
  };

  const handleSuggestionTimeoutOrNo = (argFromCaller) => {
    clearTimeout(wordSuggestionTimeoutRef.current);
    setShowCandidateOptions(false); // Hide options for the rejected candidate
    let candidateToProcess;
    if (argFromCaller && typeof argFromCaller === 'object' && 'word' in argFromCaller && 'probability' in argFromCaller) {
      candidateToProcess = argFromCaller;
    } else {
      candidateToProcess = activeWordCandidate;
    }
    console.log("handleSuggestionTimeoutOrNo", candidateToProcess); //null
    if (candidateToProcess) { 
        if (failedSuggestionCycles === 0) { // This was the first attempt for this candidate set
            setPreviouslyRejectedWordInCycle(candidateToProcess.word);
            console.log(`Word "${candidateToProcess.word}" rejected/timed out. Will be excluded from next suggestion in this cycle.`);
        }
    }
    setActiveWordCandidate(null); // Clear current candidate, this will trigger useEffect
    setFailedSuggestionCycles(prev => prev + 1);
  };


  const handleWordSelectionForPoem = useCallback(async (selectedWordObject) => {
    // This function is called when user ACCEPTS a word from the interactive flow OR from old displayableWords (if that path is re-enabled)
    if (emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || isFindingRelevantWord || !modelReady) return;

    const selectedWord = selectedWordObject.word;
    setCurrentPoemInputWord(selectedWord);
    setPoem(null); setPoemError(null); setPoemLanguage(null);
    setMainError(null);
    setTop5Keywords([]); // Clear any interactive keywords

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
      
      setMainError(`Composing ${language} poem about "${selectedWord}" with emotion "${newEmotion}"...`);

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
    emotionLoading, isGeneratingKeywords, isFetchingProbabilities, isGeneratingPoem, isFindingRelevantWord,
    setMainError, setPoem, setPoemError, setPoemLanguage, setCurrentPoemInputWord, setIsGeneratingPoem
  ]);

  // handlePoemLineRegeneration can remain largely the same if it's still a desired feature.
  // It's a separate flow once a poem exists.
  const handlePoemLineRegeneration = useCallback(async (lineText) => {
    if (emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || isFindingRelevantWord || !modelReady) return;
    setMainError(null); setPoem(null); setPoemError(null); setPoemLanguage(null);
    setCurrentPoemInputWord(lineText); 
    setTop5Keywords([]); setActiveWordCandidate(null); setShowCandidateOptions(false); // Reset interactive flow

    setIsGeneratingPoem(true); 
    let tempLoadingMessageForMainError = "";
    try {
        tempLoadingMessageForMainError = "Detecting emotion again..."; setMainError(tempLoadingMessageForMainError);
        if (!videoRef.current || !videoRef.current.srcObject || videoRef.current.srcObject.getVideoTracks().length === 0) {
            throw new Error('Video stream not available for new emotion detection.');
        }
        if (videoRef.current.paused) await videoRef.current.play().catch(err => console.warn('Unable to play video for emotion detection:', err));
        const newEmotionResult = await captureAndClassify(videoRef, canvasRef);
        if (!newEmotionResult || !newEmotionResult.emotion) throw new Error('Unable to detect new emotion for poem generation.');
        const newEmotion = newEmotionResult.emotion;

        tempLoadingMessageForMainError = `Generating keywords from line: "${lineText.substring(0, 30)}${lineText.length > 30 ? '...' : ''}"...`;
        setMainError(tempLoadingMessageForMainError);
        let mainWordForNewPoem = lineText; 
        const keywordsResponse = await fetch('/api/generateKeywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputText: lineText, emotion: newEmotion }),
        });
        if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            const newGeneratedKeywords = keywordsData.keywords || [];
            if (newGeneratedKeywords.length > 0) {
                mainWordForNewPoem = newGeneratedKeywords[0]; 
                tempLoadingMessageForMainError = "Analyzing new keywords..."; setMainError(tempLoadingMessageForMainError);
                const probResponse = await fetch('/api/getWordProbabilities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords: newGeneratedKeywords }),
                });
                if (probResponse.ok) {
                    const probData = await probResponse.json();
                    const sortedWordsWithProb = (probData.results || []).sort((a, b) => b.probability - a.probability);
                    if (sortedWordsWithProb.length > 0) mainWordForNewPoem = sortedWordsWithProb[0].word;
                }
            }
        }
        
        const language = await detectLanguage(mainWordForNewPoem);
        setPoemLanguage(language);
        tempLoadingMessageForMainError = `Composing new ${language} poem inspired by "${mainWordForNewPoem.substring(0,30)}${mainWordForNewPoem.length > 30 ? '...' : ''}"...`;
        setMainError(tempLoadingMessageForMainError);
        const poemApiResponse = await fetch('/api/generatePoem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mainWord: mainWordForNewPoem, emotion: newEmotion, language: language }),
        });
        if (!poemApiResponse.ok) {
            const errorData = await poemApiResponse.json();
            throw new Error(errorData.error || 'Unable to generate new poem from API.');
        }
        const poemData = await poemApiResponse.json();
        setPoem(poemData.poem); 
        setMainError(null); 
    } catch (error) {
        console.error("Error in poem regeneration process from line:", error);
        setPoemError(error.message || "An unknown error occurred while regenerating the poem.");
        setPoem(null); setMainError(null); 
    } finally {
        setIsGeneratingPoem(false); 
    }
  }, [
      modelReady, captureAndClassify, videoRef, canvasRef,
      emotionLoading, isGeneratingKeywords, isFetchingProbabilities, isGeneratingPoem, isFindingRelevantWord,
      setMainError, setPoem, setPoemError, setPoemLanguage, setCurrentPoemInputWord, setIsGeneratingPoem,
  ]);


  const overallLoading = emotionLoading || isGeneratingKeywords || isFetchingProbabilities || isGeneratingPoem || isFindingRelevantWord;

  let buttonText = 'Generate Ideas';
  if (!modelReady) buttonText = 'Loading Model...';
  else if (emotionLoading) buttonText = 'Detecting Emotion...'; // This is brief for initial model load
  else if (isGeneratingKeywords) buttonText = 'Generating Keywords...';
  else if (isFetchingProbabilities) buttonText = 'Analyzing Keywords...';
  else if (isFindingRelevantWord) buttonText = 'Finding Relevant Word...';
  else if (isGeneratingPoem) {
     buttonText = currentPoemInputWord ? `Composing poem about "${currentPoemInputWord.substring(0,20)}..."` : 'Composing poem...';
  }

  const resetAll = () => {
    setInputText('');
    setResult(null);
    setPoem(null);
    setPoemError(null);
    setPoemLanguage(null);
    setCurrentPoemInputWord(null);
    setMainError(null);
    
    setTop5Keywords([]);
    setActiveWordCandidate(null);
    setShowCandidateOptions(false);
    setFailedSuggestionCycles(0);
    
    clearTimeout(wordSuggestionTimeoutRef.current);
    clearTimeout(newKeywordsCycleTimeoutRef.current);
    
    //setIsGeneratingKeywords(false); // ensure loading states are also reset if flow is interrupted
    //setIsFetchingProbabilities(false);
    //setIsFindingRelevantWord(false);
    //setIsGeneratingPoem(false);
  };

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

        <div className="hidden"> {/* Keep VideoCapture hidden as before */}
          <VideoCapture videoRef={videoRef} canvasRef={canvasRef} onError={setMainError} />
        </div>

        <ProgressBar progressItems={progressItems} />

        {!poem && (
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
        )}

        {/* Updated keyword display section */}
        {top5Keywords.length > 0 && !poem && !isGeneratingPoem && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-lg font-semibold mb-1 text-gray-800">
              Current Keyword Set
            </h3>
            <p className="text-xs text-gray-500 mb-3">Based on &quot;{inputText.substring(0,30)}{inputText.length > 30 ? '...' : ''}&quot;</p>
            
            {isFindingRelevantWord && !activeWordCandidate && (
                <p className="text-sm text-indigo-600 animate-pulse my-2">Finding the best suggestion for you...</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {top5Keywords.map((item) => (
                <span 
                  key={item.word} 
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all
                    ${activeWordCandidate && activeWordCandidate.word === item.word ? 
                        'bg-yellow-200 text-yellow-900 border-yellow-400 ring-2 ring-yellow-500 shadow-md' : 
                      previouslyRejectedWordInCycle === item.word ? 
                        'bg-red-100 text-red-700 border-red-300 opacity-50 line-through' :
                        'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'}`}
                  title={activeWordCandidate && activeWordCandidate.word === item.word ? `Currently suggested: ${item.word}` : 
                         previouslyRejectedWordInCycle === item.word ? `Previously rejected: ${item.word}` :
                         `Keyword: ${item.word} (Initial Prob: ${(item.probability * 100).toFixed(0)}%)`}
                >
                  {item.word} 
                  {!(activeWordCandidate && activeWordCandidate.word === item.word) && 
                   !(previouslyRejectedWordInCycle === item.word) && 
                   ` (${(item.probability * 100).toFixed(0)}%)`}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeWordCandidate && showCandidateOptions && !poem && (
          <div className="mt-6 p-6 bg-indigo-50 rounded-xl shadow-lg border border-indigo-200">
            <h3 className="text-xl font-semibold mb-3 text-indigo-700 text-center">Poem Word Suggestion:</h3>
            <p className="text-center text-2xl font-bold text-indigo-600 my-4">
              &quot;{activeWordCandidate.word}&quot;
              <span className="text-sm font-normal block text-gray-500">Relevance: {(activeWordCandidate.probability * 100).toFixed(0)}%</span>
            </p>
            <p className="text-sm text-center text-gray-600 mb-4">
                Use this word for your poem? (Attempt {failedSuggestionCycles + 1} of 2 for this keyword set)
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleSuggestionAccepted}
                disabled={overallLoading}
                className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:bg-gray-400"
              >
                Yes, Use It!
              </button>
              <button
                onClick={handleSuggestionTimeoutOrNo}
                disabled={overallLoading}
                className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:bg-gray-400"
              >
                No, Next Suggestion
              </button>
            </div>
            <p className="text-xs text-center text-gray-500 mt-3">
                {failedSuggestionCycles < 1 ? "Or wait 5 seconds for the next suggestion." : "If you decline, we'll generate new keywords."}
            </p>
          </div>
        )}
        
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
                  onClick={() => { if (line.trim()) handlePoemLineRegeneration(line.trim()) }}
                  disabled={overallLoading || !line.trim()}
                  className={`block w-full text-left p-1 my-0.5 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-indigo-300
                    ${!line.trim() ? 'cursor-default h-4' : 
                      overallLoading ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-indigo-200 cursor-pointer'}
                  `}
                  title={line.trim() ? "Select this line to generate a new poem" : ""}
                >
                  {line.trim() ? line : <> </>}
                </button>
              ))}
            </div>
            <button
              onClick={resetAll}
              className="mt-6 w-full py-2 px-4 rounded-lg text-indigo-700 font-semibold bg-indigo-100 hover:bg-indigo-200 transition-colors"
            >
              Create Another / Enter New Idea
            </button>
          </div>
        )}

        {result && !poem && !top5Keywords.length && !activeWordCandidate && ( 
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">Last Processed Data:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-x-auto">
              <pre className="text-gray-800 font-mono text-sm whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
             <button onClick={resetAll} className="mt-2 text-sm text-indigo-600 underline">Start Over</button>
          </div>
        )}
      </div>
    </div>
  );
}