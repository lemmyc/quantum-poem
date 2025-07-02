"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
  const [showImageSection, setShowImageSection] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageGenerated, setImageGenerated] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const poemSectionRef = useRef(null);
  const imageSectionRef = useRef(null);
  const [showRealImage, setShowRealImage] = useState(false);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageApiLoading, setImageApiLoading] = useState(false);
  const [imageApiError, setImageApiError] = useState(null);

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

  // Scroll event to toggle floating buttons
  useEffect(() => {
    const poemSection = document.getElementById('poem-section');
    const imageSection = document.getElementById('image-section');
    if (!poemSection || !imageSection) return;

    let lastState = null;
    const observer = new window.IntersectionObserver(
      (entries) => {
        let poemInView = false;
        let imageInView = false;
        entries.forEach(entry => {
          if (entry.target.id === 'poem-section') poemInView = entry.isIntersecting;
          if (entry.target.id === 'image-section') imageInView = entry.isIntersecting;
        });
        if (poemInView) {
          setShowTopButton(false);
          lastState = 'poem';
        } else if (imageInView) {
          setShowTopButton(true);
          lastState = 'image';
        } else {
          setShowTopButton(false);
          lastState = null;
        }
      },
      {
        threshold: 0.2,
      }
    );
    observer.observe(poemSection);
    observer.observe(imageSection);
    return () => observer.disconnect();
  }, [showImageSection]);

  // Keep scroll event as backup for edge cases
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 100) {
        setShowTopButton(false);
        return;
      }
      const imageSection = document.getElementById('image-section');
      if (!imageSection) return;
      const rect = imageSection.getBoundingClientRect();
      if (rect.top <= 80) {
        setShowTopButton(true);
      } else {
        setShowTopButton(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleViewImageClick = () => {
    setShowImageSection(true);
    setImageLoading(true);
    setShowRealImage(false);
    setTimeout(() => {
      setImageGenerated(true);
      setImageLoading(false);
      setShowRealImage(true);
    }, 3000);
    setTimeout(() => {
      const imageSection = document.getElementById('image-section');
      if (imageSection) {
        imageSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleTopClick = () => {
    const poemSection = document.getElementById('poem-section');
    if (poemSection) {
      poemSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Do not setShowTopButton(false) here, let observer handle it
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

  // Gọi API generateImage khi poem đã load xong (chỉ gọi 1 lần)
  useEffect(() => {
    if (!poem || imageBase64 || imageApiLoading) return;
    // Chỉ gọi khi poem đã có nội dung và chưa có ảnh
    if (poem.content && poem.content.trim() !== "") {
      setImageApiLoading(true);
      setImageApiError(null);
      fetch("/api/generateImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: poem.content }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then((data) => {
          if (data.image_base64) {
            setImageBase64(data.image_base64);
          } else {
            setImageApiError("No image returned from API");
          }
        })
        .catch((err) => {
          setImageApiError(err.message || "Error generating image");
        })
        .finally(() => {
          setImageApiLoading(false);
        });
    }
  }, [poem, imageBase64, imageApiLoading]);

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
      <div className={`poem-container ${getContainerClass()}${showLoading ? ' fixed-frame' : ''}`}
        ref={poemSectionRef}
        id="poem-section"
      >
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

  const renderImageSection = () => {
    if (!showImageSection) return null;

    return (
      <div id="image-section" className="image-section" ref={imageSectionRef}>
        <div className="image-container">
          <div className="image-header">
            <h2 className="image-title">Generated Image</h2>
          </div>
          <div className="image-content">
            <div className="image-side">
              <div className="image-placeholder">
                {/* Ưu tiên hiển thị ảnh từ API nếu có */}
                {imageApiLoading ? (
                  <div className="image-generating">
                    <div className="generation-overlay">
                      <div className="generation-grid">
                        {[...Array(64)].map((_, i) => (
                          <div 
                            key={i} 
                            className="generation-cell"
                            style={{ 
                              animationDelay: `${i * 0.1}s`,
                              animationDuration: `${2 + Math.random() * 2}s`
                            }}
                          ></div>
                        ))}
                      </div>
                      <div className="generation-text">
                        <img src="/assets/bear.gif" alt="Loading..." className="loading-gif" style={{ display: 'block', margin: '0 auto', maxWidth: '120px' }} />
                        <p>Generating image from your poem...</p>
                        <div className="generation-progress">
                          <div className="progress-bar">
                            <div className="progress-fill"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : imageBase64 ? (
                  <div className="image-real-preview">
                    <img 
                      src={`data:image/png;base64,${imageBase64}`} 
                      alt="AI Generated" 
                      className="neon-image-frame"
                      key="real-image-api"
                    />
                  </div>
                ) : imageApiError ? (
                  <div className="image-error">
                    <p style={{ color: 'red' }}>Image generation failed: {imageApiError}</p>
                  </div>
                ) : showRealImage ? (
                  <div className="image-real-preview">
                    <img 
                      src="/assets/background/test_image.png" 
                      alt="AI Generated" 
                      className="neon-image-frame"
                      key={showRealImage ? 'real-image' : 'placeholder'}
                    />
                  </div>
                ) : (
                  <div className="image-preview">
                    <div className="image-frame">
                      <div className="image-overlay">
                        <span className="image-text">AI Generated Art</span>
                        <span className="image-subtitle">Based on: {poem?.title}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="poem-side">
              <div className="poem-side-content-centered">
                <div className="poem-header">
                  <div className="poem-meta">
                    <span className="emotion-indicator">
                      {emotionIcons[poem?.emotion] || "😐"} {poem?.emotion}
                    </span>
                  </div>
                </div>
                <div className="poem-content poem-content-large">
                  {poem?.content
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
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFloatingButton = () => {
  if (!showImageSection || !showTopButton) {
    return (
      <button className="floating-neon-btn view-image-btn" onClick={handleViewImageClick}>
        🖼️ View Image
      </button>
    );
  }

  if (showImageSection && showTopButton) {
    return (
      <button className="floating-neon-btn top-btn" onClick={handleTopClick}>
        ⬆️ Top
      </button>
    );
  }

  return null;
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

      {renderFloatingButton()}

      <div className="poem-section" id="poem-section">
        {renderContent()}
      </div>
      
      {renderImageSection()}
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
