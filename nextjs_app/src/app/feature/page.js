"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import SunModel from "../../components/SunModel/SunModel";
import "./page.scss";
import HackerStatsPanel from "../../components/HackerStatsPanel";
import PoemDisplay from "../../components/PoemAnimation/poemDisplay";
import VideoCapture from "../../components/VideoCapture";
import { useEmotionWorker } from "../../hooks/useEmotionWorker";
import GlowButton from "../../components/GlowButton/GlowButton";

const emotionIcons = {
  sad: "😢",
  disgust: "🤢",
  angry: "😠",
  neutral: "😐",
  fear: "😨",
  surprise: "😮",
  happy: "😊",
};
import NeonSwirlLoader from "../../components/NeonSwirlLoader/NeonSwirlLoader";

// Helper function to retry API calls
const retryApiCall = async (apiCall, maxRetries = 1) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      console.error(`API call attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) {
        throw error; // Re-throw the error if all retries failed
      }
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

function FeatureContent() {
  const searchParams = useSearchParams();
  const mainWord = searchParams.get("word");

  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState({ text: "", animate: false });
  const [extraPoems, setExtraPoems] = useState([]);
  const [mainError, setMainError] = useState(null);
  const [sphereToCorner, setSphereToCorner] = useState(false);
  const [isGeneratingPoem, setIsGeneratingPoem] = useState(false);
  const captureRef = useRef(null);

  const [latestEmotionResult, setLatestEmotionResult] = useState(null);

  const [dominantEmotion, setDominantEmotion] = useState(null);
  const [emotionStatus, setEmotionStatus] = useState("Loading model...");

  const {
    modelReady: emotionModelReady,
    captureAndClassify,
    setError: setEmotionError,
  } = useEmotionWorker();

  // Central emotion processing loop
  useEffect(() => {
    if (!emotionModelReady || !captureRef.current?.video) {
      if (!emotionModelReady) {
        setEmotionStatus("Loading model...");
      } else {
        setEmotionStatus("Initializing camera...");
      }
      return;
    }

    setEmotionStatus("Detecting...");

    const intervalId = setInterval(async () => {
      if (!captureRef.current?.video) return;
      try {
        const result = await captureAndClassify(
          captureRef.current.video,
          captureRef.current.canvas
        );
        // --- IMPORTANT CHANGE 1 ---
        // Check if `result` exists and has an `emotion` property.
        if (result && result.emotion) {
          setLatestEmotionResult(result);
        }
      } catch (err) {
        console.error("Error in central emotion detection loop:", err);
        setEmotionError("Failed to detect emotion.");
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [emotionModelReady, captureAndClassify, setEmotionError]);

  useEffect(() => {
    if (!latestEmotionResult) return;

    if (latestEmotionResult.emotion && latestEmotionResult.score) {
      setDominantEmotion({
        label: latestEmotionResult.emotion,
        score: parseFloat(latestEmotionResult.score),
        icon: emotionIcons[latestEmotionResult.emotion] || "❓",
      });
    }
  }, [latestEmotionResult]);

  const handleGeneratePoemFromSunModel = async (subWord) => {
    try {
      // Use emotion from central state
      setIsGeneratingPoem(true);
      const detectedEmotion = latestEmotionResult?.emotion || "happy";

      const result = await retryApiCall(async () => {
        const res = await fetch("/api/generatePoem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mainWord: mainWord,
            subWord: subWord,
            emotion: detectedEmotion,
          }),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        return await res.json();
      });

      const newPoemText = result.poem || "Could not generate new poem";
      setExtraPoems([{ text: newPoemText, animate: true }]);
    } catch (e) {
      console.error("Error generating poem from SunModel:", e);
      setExtraPoems([{ text: "Error generating new poem!", animate: true }]);
    } finally {
      setIsGeneratingPoem(false);
    }
  };

  useEffect(() => {
    if (!mainWord || !latestEmotionResult) return;
    if (keywords !== null) return;

    async function fetchKeywords() {
      try {
        const detectedEmotion = latestEmotionResult.emotion;
        const keywordsResponse = await fetch("/api/generateKeywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText: mainWord,
            emotion: detectedEmotion,
          }),
        });
        const tenWords = await keywordsResponse.json();
        const probResponse = await fetch("/api/getWordProbabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: tenWords.keywords }),
        });
        if (!probResponse.ok) {
          const errorData = await probResponse.json();
          throw new Error(
            errorData.error || "Unable to get new keyword probabilities."
          );
        }
        const probData = await probResponse.json();
        const newSortedWords = (probData.results || [])
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 5)
          .map((item) => ({ word: item.word, probability: item.probability }));
        if (newSortedWords.length === 0) {
          setMainError(
            "Could not determine relevant keywords. Please try again."
          );
          return;
        }
        setKeywords(newSortedWords);
      } catch (err) {
        console.error("Error fetching keywords:", err);
        setMainError("Error fetching keywords: " + err.message);
      }
    }
    fetchKeywords();
  }, [mainWord, latestEmotionResult, keywords]);

  return (
    <div className="feature-container">
      {/* GlowButton positioned in top-left corner */}
      <div className="glow-button-container">
        <GlowButton text="←" />
      </div>

      <div className="video-capture-panel">
        <div className="panel-title">
          📹 REAL-TIME FEED{" "}
          <span className="emotion-icon">{dominantEmotion?.icon}</span>
        </div>

        <div className="panel-divider" />
        <VideoCapture ref={captureRef} onError={setEmotionError} />

        {!dominantEmotion ? (
          <p className="detecting-text">{emotionStatus}</p>
        ) : (
          <></>
        )}
      </div>
      <HackerStatsPanel />
      {Array.isArray(keywords) && keywords.length > 0 ? (
        <SunModel
          mainWord={mainWord}
          keywords={keywords}
          onPoem={(newPoemText) =>
            setPoem({ text: newPoemText, animate: false })
          }
          sphereToCorner={sphereToCorner}
          onGeneratePoemFromSunModel={handleGeneratePoemFromSunModel}
          latestEmotionResult={latestEmotionResult}
        />
      ) : (
        <NeonSwirlLoader />
      )}

      {extraPoems.map((poemItem, i) => (
        <PoemDisplay
          text={poemItem.text}
          key={i}
          onWordClick={async (word) => {
            try {
              setIsGeneratingPoem(true);
              const detectedEmotion = latestEmotionResult?.emotion || "happy";
              
              const result = await retryApiCall(async () => {
                const res = await fetch("/api/generatePoem", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mainWord: mainWord,
                    subWord: word,
                    emotion: detectedEmotion,
                  }),
                });
                
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`);
                }
                
                return await res.json();
              });

              const newPoemText = result.poem || "Could not generate new poem";
              setExtraPoems([{ text: newPoemText, animate: true }]);
            } catch (e) {
              console.error("Error generating poem from word click:", e);
              setExtraPoems([
                { text: "Error generating new poem!", animate: true },
              ]);
            } finally {
              setIsGeneratingPoem(false);
            }
          }}
        />
      ))}

      {isGeneratingPoem && <NeonSwirlLoader />}
    </div>
  );
}

export default function FeaturePage() {
  return (
    <Suspense fallback={<NeonSwirlLoader />}>
      <FeatureContent />
    </Suspense>
  );
}
