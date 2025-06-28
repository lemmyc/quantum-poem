"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import NeonSwirlLoader from "../../components/NeonSwirlLoader/NeonSwirlLoader";
import "./page.scss";

// Map cảm xúc với group
const emotionGroups = {
  sad: 1,
  disgust: 1,
  fear: 1,
  angry: 1,
  happy: 2,
  surprise: 2,
  neutral: 3,
};

// Map ngôn ngữ với code
const languageCodes = {
  vietnamese: "vi",
  japanese: "ja",
  korean: "ko",
  english: "en",
};

// Hàm lấy background image với fallback
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
  const [showLoading, setShowLoading] = useState(true);
  const [lastWordCount, setLastWordCount] = useState(0);

  // Lấy bài thơ từ URL params
  useEffect(() => {
    const poemFromParams = searchParams.get("poem");
    const emotionFromParams = searchParams.get("emotion");
    const keywordsFromParams = searchParams.get("keywords");
    const languageFromParams = searchParams.get("language");

    setShowLoading(true); // Luôn bật loading khi bắt đầu

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

        // Chỉ tắt loading sau 700ms (hoặc khi chắc chắn mọi thứ đã xong)
        setTimeout(() => setShowLoading(false), 700);
      } catch (e) {
        console.error("Error parsing poem from URL:", e);
        setError("Could not load the poem. It might be corrupted.");
        setBackgroundImage(getBackgroundImage("neutral", "vn"));
        setShowLoading(false);
      }
    } else {
      setError(
        "No poem data found in the URL. Please go back and create a poem first."
      );
      setBackgroundImage(getBackgroundImage("neutral", "vi"));
      setShowLoading(false);
    }
  }, [searchParams]);

  // Theo dõi khi số từ đổi thì show loading, sau đó tắt loading sau 700ms (bằng hoặc hơn transition)
  useEffect(() => {
    if (!poem) return;
    const wordCount = getWordCount();
    if (wordCount !== lastWordCount) {
      setLastWordCount(wordCount);
      const currentClass = wordCount > 20 ? "large-frame" : "small-frame";
      const previousClass = lastWordCount > 20 ? "large-frame" : "small-frame";
      
      if (currentClass !== previousClass) {
        setShowLoading(true);
        const timeout = setTimeout(() => setShowLoading(false), 700);
        return () => clearTimeout(timeout);
      }
    } else {
      setShowLoading(false);
    }
  }, [poem, lastWordCount]);

  const handleBackClick = () => {
    window.history.back();
  };

  // Mouse move handler for particle interaction
  useEffect(() => {
    const handleMouseMove = (e) => {
      const particles = document.querySelectorAll(".particle");
      particles.forEach((particle) => {
        const rect = particle.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 100) {
          const angle = Math.atan2(dy, dx);
          particle.style.transform = `translate(${Math.cos(angle) * 10}px, ${Math.cos(angle) * 10}px)`;
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const emotionIcons = {
    sad: "😢",
    disgust: "🤢",
    angry: "😠",
    neutral: "😐",
    fear: "😨",
    surprise: "😮",
    happy: "😊",
  };

  // Deterministic glyph selection
  const getGlyph = (index) => {
    const glyphs = ["0", "1", "◆", "⬟"];
    return glyphs[index % glyphs.length];
  };

  // Calculate word count
  const getWordCount = () => {
    if (!poem) return 0;
    const titleWords = poem.title ? poem.title.split(/\s+/).length : 0;
    const contentWords = poem.content
      ? poem.content.split(/\s+/).filter((word) => word.trim()).length
      : 0;
    return titleWords + contentWords;
  };

  // Determine container class based on word count
  const getContainerClass = () => {
    const wordCount = getWordCount();
    if (wordCount > 20) return "large-frame";
    return "small-frame";
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
      <div className={`poem-container ${getContainerClass()}${showLoading ? ' fixed-frame' : ''}`}>
        {showLoading && (
          <div className="poem-loading-overlay">
            <NeonSwirlLoader />
          </div>
        )}
        <div className="holo-field">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`holo-particle holo-particle-${i + 1}`}></div>
          ))}
        </div>
        <div className="poem-header">
          <h1 className="poem-title" data-text={poem.title}>{poem.title}</h1>
          <div className="poem-meta">
            <span className="emotion-indicator">
              {emotionIcons[poem.emotion] || "😐"} {poem.emotion}
            </span>
          </div>
        </div>

        <div className="poem-content">
          {poem.content
            .split("\n")
            .map(
              (line, index) =>
                line.trim() && (
                  <p key={index} className="poem-line" data-text={line}>
                    <span className="glitch-overlay" data-text={line}></span>
                    {line.split(' ').map((word, wordIndex) => (
                      <span 
                        key={wordIndex} 
                        className="word"
                        style={{ 
                          animationDelay: `${index * 0.3 + wordIndex * 0.1}s`,
                          marginRight: '0.3em'
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </p>
                )
            )}
        </div>

        {poem.keywords.length > 0 && (
          <div className="poem-keywords">
            <h3>Keywords</h3>
            <div className="keywords-list">
              {poem.keywords.map((keyword, index) => (
                <span key={index} className="keyword-tag" style={{ animationDelay: `${index * 0.3}s` }}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
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
      {showLoading && (
        <div className="global-loading-overlay">
          <NeonSwirlLoader />
        </div>
      )}
      <div className="aurora-gradient"></div>
      <div className="aurora-gradient aurora-secondary"></div>
      <div className="glitch-overlay"></div>
      <div className="neon-grid"></div>
      <div className="cityscape-layer"></div>
      <div className="scanline-overlay"></div>
      <div className="starry-sky"></div>
      <div className="pulse-wave"></div>
      <div className="data-stream"></div>
      <div className="circuit-overlay"></div>
      {[...Array(70)].map((_, i) => (
        <div key={i} className={`particle particle-${i + 1}`}>
          {getGlyph(i)}
        </div>
      ))}
      <div className="back-button-container">
        <button className="neon-back-button" onClick={handleBackClick}>
          ← Back
        </button>
      </div>
      {renderContent()}
    </div>
  );
}

import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PoemClient />
    </Suspense>
  );
}
