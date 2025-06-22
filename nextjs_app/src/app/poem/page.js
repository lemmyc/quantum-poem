"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import GlowButton from "../../components/GlowButton/GlowButton";
import NeonSwirlLoader from "../../components/NeonSwirlLoader/NeonSwirlLoader";
import "./page.scss";

// Map cảm xúc với group
const emotionGroups = {
  // Group 1: Sad, Disgust, Fear, Angry
  sad: 1,
  disgust: 1,
  fear: 1,
  angry: 1,
  // Group 2: Happy, Surprise
  happy: 2,
  surprise: 2,
  // Group 3: Neutral
  neutral: 3,
};

// Map ngôn ngữ với code
const languageCodes = {
  vietnamese: "vi",
  japanese: "ja",
  korean: "ko",
  english: "en",
};

// Hàm lấy background image
const getBackgroundImage = (emotion, language = "vn") => {
  const group = emotionGroups[emotion] || 1;
  const langCode = languageCodes[language] || language || "vi";

  return `/assets/poem_bg/${langCode}_group${group}.jpg`;
};

function PoemClient() {
  const searchParams = useSearchParams();
  const [poem, setPoem] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [error, setError] = useState("");

  // Lấy bài thơ từ URL params
  useEffect(() => {
    const poemFromParams = searchParams.get("poem");
    const emotionFromParams = searchParams.get("emotion");
    const keywordsFromParams = searchParams.get("keywords");
    const languageFromParams = searchParams.get("language");

    if (poemFromParams) {
      try {
        const parsedPoem = JSON.parse(decodeURIComponent(poemFromParams));
        const updatedPoem = {
          ...parsedPoem,
          emotion: emotionFromParams || "neutral",
          language: languageFromParams || "vn",
          keywords: keywordsFromParams
            ? keywordsFromParams.split(",").filter((k) => k)
            : [],
        };
        setPoem(updatedPoem);

        const bgImage = getBackgroundImage(
          updatedPoem.emotion,
          updatedPoem.language
        );
        setBackgroundImage(bgImage);
      } catch (e) {
        console.error("Error parsing poem from URL:", e);
        setError("Could not load the poem. It might be corrupted.");
        setBackgroundImage(getBackgroundImage("neutral", "vn")); // A neutral background for errors
      }
    } else {
      setError(
        "No poem data found in the URL. Please go back and create a poem first."
      );
      setBackgroundImage(getBackgroundImage("neutral", "vi"));
    }
  }, [searchParams]);

  const handleBackClick = () => {
    window.history.back();
  };

  const emotionIcons = {
    sad: "😢",
    disgust: "🤢",
    angry: "😠",
    neutral: "😐",
    fear: "😨",
    surprise: "😮",
    happy: "😊",
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="poem-error-container">
          <h1>Error</h1>
          <p>{error}</p>
        </div>
      );
    }

    if (!poem) {
      return <NeonSwirlLoader />;
    }

    return (
      <div className="poem-container">
        <div className="poem-header">
          <h1 className="poem-title">
            {poem.title}
          </h1>
        </div>

        <div className="poem-content">
          {poem.content
            .split("\n")
            .map(
              (line, index) =>
                line.trim() && (
                  <p key={index} className="poem-line">
                    {line}
                  </p>
                )
            )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="poem-page"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
      }}
    >
      <div className="aurora-gradient"></div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className={`particle particle-${i + 1}`}></div>
      ))}
      {/* Back button */}
      <div className="back-button-container">
        <GlowButton text="←" onClick={handleBackClick} />
      </div>

      {renderContent()}
    </div>
  );
}

// page.js là Server Component, chỉ render <Suspense><PoemClient /></Suspense>
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PoemClient />
    </Suspense>
  );
} 