"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import SunModel from "../../components/SunModel/SunModel";
import "./page.scss";
import HackerStatsPanel from "../../components/HackerStatsPanel";
import PoemDisplay from "../../components/PoemAnimation/poemDisplay";
import VideoCapture from "../../components/VideoCapture";
import { useEmotionWorker } from "../../hooks/useEmotionWorker";

function FeatureContent() {
  const searchParams = useSearchParams();
  const mainWord = searchParams.get("word");

  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState({ text: "", animate: false });
  const [extraPoems, setExtraPoems] = useState([]);
  const [mainError, setMainError] = useState(null);
  const [sphereToCorner, setSphereToCorner] = useState(false);
  const captureRef = useRef(null);

  // 1. State to track if the 3D model is ready.
  const [isModelReady, setIsModelReady] = useState(false);

  const {
    modelReady: emotionModelReady, // Renamed to avoid confusion
    captureAndClassify,
    setError: setEmotionError,
  } = useEmotionWorker();

  // 2. Callback function to be passed to SunModel.
  //    SunModel will call this function when it's fully loaded.
  const handleModelReady = useCallback(() => {
    console.log("SunModel has finished loading and is ready.");
    setIsModelReady(true);
  }, []); // Empty dependency array as setIsModelReady is stable

  const detectEmotion = useCallback(
    async (fallbackEmotion) => {
      if (
        captureRef.current &&
        captureRef.current.video &&
        emotionModelReady
      ) {
        try {
          const emotionResult = await captureAndClassify(
            captureRef.current.video,
            captureRef.current.canvas
          );
          if (emotionResult && emotionResult.emotion) {
            return emotionResult.emotion;
          }
        } catch (error) {
          console.error("Error detecting emotion:", error);
        }
      }
      return fallbackEmotion;
    },
    [emotionModelReady, captureAndClassify]
  );

  // This API call is for interaction, so we should guard it.
  const handleGeneratePoemFromSunModel = async (subWord) => {
    // 3. Guard the API call. Only proceed if the model is ready.
    if (!mainWord || !isModelReady) {
        console.log("Model not ready, skipping API call for new poem.");
        return;
    }
    try {
      const detectedEmotion = await detectEmotion("happy"); // Provide a fallback

      const res = await fetch("/api/generatePoem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainWord: mainWord,
          subWord: subWord,
          emotion: detectedEmotion,
          language: "vietnamese",
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

  // This effect fetches initial data FOR the model, so it should run before.
  // It does not need to be guarded by isModelReady.
  useEffect(() => {
    async function fetchKeywords() {
      if (!mainWord) return;
      try {
        const detectedEmotion = await detectEmotion("happy"); // Provide a fallback

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
  }, [mainWord, detectEmotion]);

  return (
    <div className="feature-container">
      <div className="video-capture-panel">
        <div className="panel-title">📹 REAL-TIME FEED</div>
        <div className="panel-divider" />
        <VideoCapture ref={captureRef} onError={setEmotionError} />
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
          getLatestEmotion={detectEmotion}
          // 4. Pass the callback function as a prop to the SunModel.
          onReady={handleModelReady}
        />
      ) : (
        <div>Loading...</div>
      )}

      {extraPoems.map((poemItem, i) => (
        <PoemDisplay
          text={poemItem.text}
          key={i}
          onWordClick={async (word) => {
            // Also good to guard this interactive API call.
            if (!isModelReady) {
                console.log("Model not ready, skipping API call from word click.");
                return;
            }
            try {
              const detectedEmotion = await detectEmotion("happy");
              const res = await fetch("/api/generatePoem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mainWord: mainWord,
                  subWord: word,
                  emotion: detectedEmotion,
                  language: "vietnamese",
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