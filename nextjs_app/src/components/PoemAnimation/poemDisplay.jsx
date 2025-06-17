import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from './poemDisplay.module.scss';

const PoemDisplay = ({ text, onWordClick }) => {
  const [disperseData, setDisperseData] = useState([]);
  const [reassembled, setReassembled] = useState(false);
  const [glitchIndex, setGlitchIndex] = useState(0);
  const animationFrameId = useRef(null);
  const lastUpdateRef = useRef(0);
  const startTimeRef = useRef(0);

  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const isLargePoem = wordCount > 50;

  const glitchClasses = [
    'glitch-out-extreme',
    'glitch-out-flicker',
    'glitch-out-zoom',
  ];

  // Initialize characters with random positions for small poems
  useEffect(() => {
    if (!isLargePoem) {
      const initialData = text.split('').map((char, idx) => ({
        char,
        x: ((Math.random() * window.innerWidth - window.innerWidth / 2) * 0.6).toFixed(2),
        y: ((Math.random() * window.innerHeight - window.innerHeight / 2) * 0.6).toFixed(2),
        r: (Math.random() * 360 - 180).toFixed(2),
        phase: Math.random() * 2 * Math.PI,
        scale: (Math.random() * 0.5 + 0.8).toFixed(2),
        idx,
        wordIndex: text.slice(0, idx + 1).split(' ').length - 1,
        lineIndex: text.slice(0, idx + 1).split('\n').length - 1,
      }));
      setDisperseData(initialData);
    } else {
      // For large poems, initialize with index-based data for glitch
      const initialData = text.split('').map((char, idx) => ({
        char,
        idx,
        wordIndex: text.slice(0, idx + 1).split(' ').length - 1,
        lineIndex: text.slice(0, idx + 1).split('\n').length - 1,
      }));
      setDisperseData(initialData);
    }
    setReassembled(false);
    setGlitchIndex(0);
  }, [text, isLargePoem]);

  // Dispersion animation for small poems
  useEffect(() => {
    if (!isLargePoem && !reassembled && disperseData.length > 0) {
      startTimeRef.current = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTimeRef.current;
        if (elapsed >= 3500) {
          setReassembled(true);
          return;
        }
        if (currentTime - lastUpdateRef.current >= 50) {
          setDisperseData((prev) =>
            prev.map((item) => {
              const time = currentTime / 1000;
              const dx = (Math.random() * 40 - 20 + 30 * Math.sin(time + item.phase)).toFixed(2);
              const dy = (Math.random() * 40 - 20 + 30 * Math.cos(time + item.phase)).toFixed(2);
              const dr = (Math.random() * 30 - 15).toFixed(2);
              const scale = (Math.random() * 0.5 + 0.8).toFixed(2);
              return {
                ...item,
                x: (parseFloat(item.x) + parseFloat(dx) * 0.3).toFixed(2),
                y: (parseFloat(item.y) + parseFloat(dy) * 0.3).toFixed(2),
                r: (parseFloat(item.r) + parseFloat(dr) * 0.3).toFixed(2),
                scale,
              };
            })
          );
          lastUpdateRef.current = currentTime;
        }
        animationFrameId.current = requestAnimationFrame(animate);
      };
      animationFrameId.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [reassembled, disperseData.length, isLargePoem]);

  // Trigger glitch for large poems
  useEffect(() => {
    if (isLargePoem && !reassembled) {
      const glitchDuration = 1600; // Match CSS animation duration
      setTimeout(() => {
        setReassembled(true);
        setGlitchIndex((prev) => (prev + 1) % glitchClasses.length);
      }, glitchDuration);
    }
  }, [isLargePoem, reassembled, glitchClasses.length]);

  const handleWordClick = useCallback((word) => {
    if (onWordClick) {
      onWordClick(word);
    }
  }, [onWordClick]);

  const renderPoem = () => {
    const lines = [];
    let currentLine = [];
    let currentWord = [];
    let currentWordIndex = 0;
    let currentLineIndex = 0;

    disperseData.forEach((item, i) => {
      if (item.char === '\n') {
        if (currentWord.length > 0) {
          currentLine.push({
            word: currentWord.join(''),
            chars: currentWord,
            wordIndex: currentWordIndex++,
          });
          currentWord = [];
        }
        lines.push({ line: currentLine, lineIndex: currentLineIndex++ });
        currentLine = [];
      } else if (item.char === ' ') {
        if (currentWord.length > 0) {
          currentLine.push({
            word: currentWord.join(''),
            chars: currentWord,
            wordIndex: currentWordIndex++,
          });
          currentWord = [];
        }
      } else {
        currentWord.push(item);
      }
    });

    if (currentWord.length > 0) {
      currentLine.push({
        word: currentWord.join(''),
        chars: currentWord,
        wordIndex: currentWordIndex,
      });
    }
    if (currentLine.length > 0) {
      lines.push({ line: currentLine, lineIndex: currentLineIndex });
    }

    return lines.map(({ line, lineIndex }) => (
      <div key={lineIndex} className={styles.line}>
        {line.map(({ word, chars, wordIndex }) => (
          <span
            key={`${lineIndex}-${wordIndex}`}
            className={styles.word}
            onClick={() => handleWordClick(word)}
            onKeyDown={(e) => e.key === 'Enter' && handleWordClick(word)}
            role="button"
            tabIndex={0}
            aria-label={`Word: ${word}`}
          >
            {chars.map((item, charIndex) => (
              <span
                key={`${lineIndex}-${wordIndex}-${charIndex}`}
                className={`${styles.letter} ${
                  isLargePoem
                    ? reassembled
                      ? styles['wave-in-glow']
                      : styles[glitchClasses[glitchIndex]]
                    : reassembled
                    ? styles.reassemble
                    : styles.disperse
                }`}
                style={
                  isLargePoem
                    ? {
                        animationDelay: reassembled
                          ? `${Math.abs(charIndex - chars.length / 2) * 40}ms`
                          : `${charIndex * 80}ms`,
                      }
                    : {
                        '--x': `${item.x}px`,
                        '--y': `${item.y}px`,
                        '--r': `${item.r}deg`,
                        '--idx': item.idx,
                        '--scale': item.scale,
                        transform: reassembled
                          ? `translate(0px, 0px) rotate(0deg) scale(1)`
                          : `translate(${item.x}px, ${item.y}px) rotate(${item.r}deg) scale(${item.scale})`,
                        transition: reassembled
                          ? `transform 2s cubic-bezier(0.68, -0.6, 0.2, 1.8) ${item.idx * 0.06}s, opacity 1.2s ease-in-out ${item.idx * 0.06}s, filter 1.2s ease-in-out ${item.idx * 0.06}s`
                          : 'none',
                        opacity: reassembled ? 1 : 0.7,
                        display: 'inline-block',
                      }
                }
              >
                {item.char}
              </span>
            ))}
          </span>
        ))}
      </div>
    ));
  };

  // Create sparkles
  const sparkles = Array.from({ length: isLargePoem ? 12 : 8 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    dx: (Math.random() * 2 - 1) * (isLargePoem ? 0.6 : 0.4),
    dy: (Math.random() * 2 - 1) * (isLargePoem ? 0.6 : 0.4),
    delay: Math.random() * (isLargePoem ? 3 : 4),
  }));

  return (
    <div className={`${styles['poem-stats-panel']} ${isLargePoem ? styles['large-poem'] : ''}`}>
      {renderPoem()}
      <div className={styles['background-particles']}>
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            className={styles.sparkle}
            style={{
              '--dx': sparkle.dx,
              '--dy': sparkle.dy,
              '--delay': `${sparkle.delay}s`,
              top: `${sparkle.y}%`,
              left: `${sparkle.x}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PoemDisplay;