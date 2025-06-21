"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import SunModel from "../../components/SunModel/SunModel";
import "./page.scss";
import HackerStatsPanel from "../../components/HackerStatsPanel";
import PoemDisplay from "../../components/PoemAnimation/poemDisplay";
import VideoCapture from "../../components/VideoCapture";
import { useEmotionWorker } from "../../hooks/useEmotionWorker";
import NeonSwirlLoader from "../../components/NeonSwirlLoader/NeonSwirlLoader";

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

  const {
    modelReady: emotionModelReady, // Renamed to avoid confusion
    captureAndClassify,
    setError: setEmotionError,
  } = useEmotionWorker();

  const detectEmotion = useCallback(
    async (fallbackEmotion) => {
      if (captureRef.current && captureRef.current.video && emotionModelReady) {
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

  const handleGeneratePoemFromSunModel = async (subWord) => {
    try {
      setIsGeneratingPoem(true);
      const detectedEmotion = await detectEmotion("happy");

      const res = await fetch("/api/generatePoem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainWord: mainWord,
          subWord: subWord,
          emotion: detectedEmotion
        }),
      });
      const data = await res.json();
      const newPoemText = data.poem || "Could not generate new poem";
      setExtraPoems([{ text: newPoemText, animate: true }]);
    } catch (e) {
      console.error("Error generating poem from SunModel:", e);
      setExtraPoems([{ text: "Error generating new poem!", animate: true }]);
    } finally {
      setIsGeneratingPoem(false);
    }
  };

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
              const detectedEmotion = await detectEmotion("happy");
              const res = await fetch("/api/generatePoem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mainWord: mainWord,
                  subWord: word,
                  emotion: detectedEmotion
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
