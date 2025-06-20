"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import SunModel from "../../components/SunModel/SunModel";
import "./page.scss";
import HackerStatsPanel from "../../components/HackerStatsPanel";
import PoemDisplay from "../../components/PoemAnimation/poemDisplay";
import VideoCapture from "../../components/VideoCapture";
import { useEmotionWorker } from "../../hooks/useEmotionWorker";

const emotionIcons = {
  sad: "😢",
  disgust: "🤢",
  angry: "😠",
  neutral: "😐",
  fear: "😨",
  surprise: "😮",
  happy: "😊",
};

function FeatureContent() {
  const searchParams = useSearchParams();
  const mainWord = searchParams.get("word");

  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState({ text: "", animate: false });
  const [extraPoems, setExtraPoems] = useState([]);
  const [mainError, setMainError] = useState(null);
  const [sphereToCorner, setSphereToCorner] = useState(false);
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
      const detectedEmotion = latestEmotionResult?.emotion || "happy";

      const res = await fetch("/api/generatePoem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainWord: mainWord,
          subWord: subWord,
          emotion: detectedEmotion,
        }),
      });
      const data = await res.json();
      const newPoemText = data.poem || "Could not generate new poem";
      setExtraPoems([{ text: newPoemText, animate: true }]);
    } catch (e) {
      console.error("Error generating poem from SunModel:", e);
      setExtraPoems([{ text: "Error generating new poem!", animate: true }]);
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
          .slice(0, 4)
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
        <div>Loading...</div>
      )}

      {extraPoems.map((poemItem, i) => (
        <PoemDisplay
          text={poemItem.text}
          key={i}
          onWordClick={async (word) => {
            try {
              const detectedEmotion = latestEmotionResult?.emotion || "happy";
              const res = await fetch("/api/generatePoem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mainWord: mainWord,
                  subWord: word,
                  emotion: detectedEmotion,
                }),
              });
              const data = await res.json();
              const newPoemText = data.poem || "Could not generate new poem";
              setExtraPoems([{ text: newPoemText, animate: true }]);
            } catch (e) {
              console.error("Error generating poem from word click:", e);
              setExtraPoems([
                { text: "Error generating new poem!", animate: true },
              ]);
            }
          }}
        />
      ))}
    </div>
  );
}

export default function FeaturePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FeatureContent />
    </Suspense>
  );
}
