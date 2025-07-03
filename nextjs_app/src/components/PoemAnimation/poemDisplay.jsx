import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from './poemDisplay.module.scss';
import { Popover, Button } from 'antd';

// Bổ sung bảng icon cảm xúc
const emotionIcons = {
  sad: "😢",
  disgust: "🤢",
  angry: "😠",
  neutral: "😐",
  fear: "😨",
  surprise: "😮",
  happy: "😊",
};

// Hàm lọc bỏ dấu chấm và dấu phẩy chỉ cho thơ Trung và Nhật
const removePunctuation = (text, language) => {
  // Chỉ loại bỏ dấu câu cho tiếng Trung và tiếng Nhật
  if (language === 'cn' || language === 'ja') {
    // Loại bỏ cả dấu câu phương Tây (.,) và dấu câu truyền thống châu Á (，。)
    return text.replace(/[.,，。]/g, '');
  }
  // Giữ nguyên text cho các ngôn ngữ khác
  return text;
};

const PoemDisplay = ({ text, onWordClick, emotion, language }) => {
  // Lọc bỏ dấu chấm và dấu phẩy từ text chỉ cho thơ Trung và Nhật
  const cleanedText = removePunctuation(text, language);
  
  const [disperseData, setDisperseData] = useState([]);
  const [reassembled, setReassembled] = useState(false);
  const [glitchIndex, setGlitchIndex] = useState(0);
  const animationFrameId = useRef(null);
  const lastUpdateRef = useRef(0);
  const startTimeRef = useRef(0);
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);

  // Tooltip confirm state
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedPhrase, setSelectedPhrase] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
  const isLargePoem = wordCount > 50;

  const glitchClasses = [
    'glitch-out-extreme',
    'glitch-out-flicker',
    'glitch-out-zoom',
  ];

  const isVertical = language === 'ja' || language === 'cn';

  // Initialize characters with random positions for small poems
  useEffect(() => {
    if (isVertical) {
      // Vertical poem: disperse theo cột/dòng
      const lines = cleanedText.split('\n');
      const maxLen = Math.max(...lines.map(line => line.length));
      const initialData = [];
      lines.forEach((line, colIdx) => {
        for (let rowIdx = 0; rowIdx < maxLen; rowIdx++) {
          const char = line[rowIdx] || ' ';
          initialData.push({
            char,
            col: colIdx,
            row: rowIdx,
            x: (Math.random() * 120 - 60).toFixed(2),
            y: (Math.random() * 120 - 60).toFixed(2),
            r: (Math.random() * 60 - 30).toFixed(2),
            scale: (Math.random() * 0.5 + 0.8).toFixed(2),
            idx: colIdx * maxLen + rowIdx,
          });
        }
      });
      setDisperseData(initialData);
      setReassembled(false);
      setGlitchIndex(0);
      return;
    }
    if (!isLargePoem) {
      const initialData = cleanedText.split('').map((char, idx) => ({
        char,
        x: ((Math.random() * window.innerWidth - window.innerWidth / 2) * 0.6).toFixed(2),
        y: ((Math.random() * window.innerHeight - window.innerHeight / 2) * 0.6).toFixed(2),
        r: (Math.random() * 360 - 180).toFixed(2),
        phase: Math.random() * 2 * Math.PI,
        scale: (Math.random() * 0.5 + 0.8).toFixed(2),
        idx,
        wordIndex: cleanedText.slice(0, idx + 1).split(' ').length - 1,
        lineIndex: cleanedText.slice(0, idx + 1).split('\n').length - 1,
      }));
      setDisperseData(initialData);
    } else {
      // For large poems, initialize with index-based data for glitch
      const initialData = cleanedText.split('').map((char, idx) => ({
        char,
        idx,
        wordIndex: cleanedText.slice(0, idx + 1).split(' ').length - 1,
        lineIndex: cleanedText.slice(0, idx + 1).split('\n').length - 1,
      }));
      setDisperseData(initialData);
    }
    setReassembled(false);
    setGlitchIndex(0);
  }, [cleanedText, isLargePoem, isVertical]);

  // Dispersion animation for small poems and vertical poems
  useEffect(() => {
    if (isVertical && !reassembled && disperseData.length > 0) {
      startTimeRef.current = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTimeRef.current;
        if (elapsed >= 1500) {
          setReassembled(true);
          return;
        }
        if (currentTime - lastUpdateRef.current >= 50) {
          setDisperseData((prev) =>
            prev.map((item) => {
              const dx = (Math.random() * 40 - 20).toFixed(2);
              const dy = (Math.random() * 40 - 20).toFixed(2);
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
    if (!isVertical && !isLargePoem && !reassembled && disperseData.length > 0) {
      startTimeRef.current = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTimeRef.current;
        if (elapsed >= 1500) {
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
  }, [reassembled, disperseData.length, isLargePoem, isVertical]);

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

  // Hàm lấy text được bôi đen
  function getSelectedText() {
    if (window.getSelection) {
      return window.getSelection().toString(); // KHÔNG trim để giữ khoảng trắng
    }
    return '';
  }

  // Xác nhận chọn cụm từ
  const handleConfirmSelectedPhrase = () => {
    setShowTooltip(false);
    if (selectedPhrase) {
      handleWordClick(selectedPhrase);
    }
    setSelectedPhrase('');
  };
  const handleCancelSelectedPhrase = () => {
    setShowTooltip(false);
    setSelectedPhrase('');
  };

  // Lấy icon cảm xúc hiện tại
  const currentEmotionIcon = emotionIcons[emotion] || '';

  const renderPoem = () => {
    if (isVertical) {
      const lines = cleanedText.split('\n');
      const maxLen = Math.max(...lines.map(line => line.length));
      // Render vertical poem với hiệu ứng động
      return (
        <div
          className={styles['vertical-poem']}
          style={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'flex-start' }}
          onMouseUp={e => {
            const selection = window.getSelection();
            const selected = selection.toString();
            if (selected) {
              // Lấy vị trí vùng bôi đen (góc trên phải)
              let rect = null;
              try {
                rect = selection.getRangeAt(0).getBoundingClientRect();
              } catch (err) {}
              if (rect) {
                setTooltipPosition({ x: rect.right, y: rect.top });
              } else {
                setTooltipPosition({ x: e.clientX, y: e.clientY });
              }
              setSelectedPhrase(selected);
              setShowTooltip(true);
            }
          }}
        >
          {/* Tooltip xác nhận cụm từ cho vertical */}
          {showTooltip && selectedPhrase && (
            <Popover
              open={true}
              content={
                <div style={{ textAlign: 'center', minWidth: 120 }}>
                  <span style={{ fontSize: 24, marginRight: 8 }}>{currentEmotionIcon}</span>
                  <b style={{ whiteSpace: 'pre-wrap' }}>{selectedPhrase}</b>
                  <div style={{ marginTop: 8 }}>
                    <Button type="primary" size="small" onClick={handleConfirmSelectedPhrase} style={{ marginRight: 8 }}>OK</Button>
                    <Button size="small" onClick={handleCancelSelectedPhrase}>Cancel</Button>
                  </div>
                </div>
              }
              placement="topRight"
              arrowPointAtCenter
              overlayStyle={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y - 8, zIndex: 9999 }}
            >
              <span style={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y, width: 0, height: 0 }} />
            </Popover>
          )}
          {Array.from({ length: lines.length }).map((_, colIdx) => (
            <div key={colIdx} className={styles['poem-line']} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 0.5em' }}>
              {Array.from({ length: maxLen }).map((_, rowIdx) => {
                const item = disperseData.find(d => d.col === colIdx && d.row === rowIdx);
                if (!item) return <span key={rowIdx} style={{ minHeight: '1.2em' }} />;
                return (
                  <span
                    key={rowIdx}
                    className={styles.letter}
                    style={
                      reassembled
                        ? {
                            display: 'block',
                            minHeight: '1.2em',
                            cursor: item.char.trim() ? 'pointer' : 'default',
                            transform: 'translate(0px, 0px) rotate(0deg) scale(1)',
                            transition: `transform 2s cubic-bezier(0.68, -0.6, 0.2, 1.8) ${item.idx * 0.06}s, opacity 1.2s ease-in-out ${item.idx * 0.06}s, filter 1.2s ease-in-out ${item.idx * 0.06}s`,
                            opacity: 1,
                          }
                        : {
                            display: 'block',
                            minHeight: '1.2em',
                            cursor: item.char.trim() ? 'pointer' : 'default',
                            transform: `translate(${item.x}px, ${item.y}px) rotate(${item.r}deg) scale(${item.scale})`,
                            opacity: 0.7,
                          }
                    }
                    onClick={() => {
                      // Nếu không có selection, xác định từ chứa ký tự này
                      const chars = lines[colIdx].split('');
                      let start = rowIdx, end = rowIdx;
                      while (start > 0 && chars[start - 1].trim() && chars[start - 1] !== ' ') start--;
                      while (end < chars.length - 1 && chars[end + 1].trim() && chars[end + 1] !== ' ') end++;
                      const word = chars.slice(start, end + 1).join('').trim();
                      if (word && !getSelectedText()) {
                        handleWordClick(word);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Char: ${item.char}`}
                  >
                    {item.char === ' ' ? '\u00A0' : item.char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    const lines = [];
    let currentLine = [];
    let currentWord = [];
    let currentWordIndex = 0;
    let currentLineIndex = 0;

    disperseData.forEach((item, i) => {
      if (item.char === '\n') {
        if (currentWord.length > 0) {
          currentLine.push({
            word: currentWord.map(c => c.char).join(''),
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
            word: currentWord.map(c => c.char).join(''),
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
        word: currentWord.map(c => c.char).join(''),
        chars: currentWord,
        wordIndex: currentWordIndex,
      });
    }
    if (currentLine.length > 0) {
      lines.push({ line: currentLine, lineIndex: currentLineIndex });
    }

    return lines.map(({ line, lineIndex }) => {
      // Capitalize first letter of the line
      let lineText = line.map(w => w.word).join(' ');
      if (lineText.length > 0) {
        lineText = lineText.charAt(0).toUpperCase() + lineText.slice(1);
      }
      // Map lại các chars cho từ đầu tiên của dòng nếu cần
      let firstWord = line[0];
      if (firstWord && firstWord.chars && firstWord.chars.length > 0) {
        firstWord = {
          ...firstWord,
          chars: [
            { ...firstWord.chars[0], char: firstWord.chars[0].char.toUpperCase() },
            ...firstWord.chars.slice(1)
          ]
        };
      }
      const newLine = [firstWord, ...line.slice(1)];
      return (
        <div
          key={lineIndex}
          className={styles.line}
          onMouseUp={e => {
            const selection = window.getSelection();
            const selected = selection.toString();
            if (selected) {
              // Lấy vị trí vùng bôi đen (góc trên phải)
              let rect = null;
              try {
                rect = selection.getRangeAt(0).getBoundingClientRect();
              } catch (err) {}
              if (rect) {
                setTooltipPosition({ x: rect.right, y: rect.top });
              } else {
                setTooltipPosition({ x: e.clientX, y: e.clientY });
              }
              setSelectedPhrase(selected);
              setShowTooltip(true);
            }
            // Nếu không có selection, không làm gì ở đây (click từ sẽ xử lý riêng)
          }}
          style={{ userSelect: 'text', cursor: 'pointer', position: 'relative' }}
        >
          {/* Tooltip xác nhận cụm từ */}
          {showTooltip && selectedPhrase && (
            <Popover
              open={true}
              content={
                <div style={{ textAlign: 'center', minWidth: 120 }}>
                  <span style={{ fontSize: 24, marginRight: 8 }}>{currentEmotionIcon}</span>
                  <b style={{ whiteSpace: 'pre-wrap' }}>{selectedPhrase}</b>
                  <div style={{ marginTop: 8 }}>
                    <Button type="primary" size="small" onClick={handleConfirmSelectedPhrase} style={{ marginRight: 8 }}>OK</Button>
                    <Button size="small" onClick={handleCancelSelectedPhrase}>Cancel</Button>
                  </div>
                </div>
              }
              placement="topRight"
              arrowPointAtCenter
              overlayStyle={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y - 8, zIndex: 9999 }}
            >
              <span style={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y, width: 0, height: 0 }} />
            </Popover>
          )}
          {newLine.map(({ word, chars, wordIndex }, wordIdx) => (
            <span
              key={`${lineIndex}-${wordIndex}`}
              className={
                styles.word +
                (hoveredLineIndex === `${lineIndex}-${wordIndex}` ? ' ' + styles.highlight : '')
              }
              onMouseEnter={() => setHoveredLineIndex(`${lineIndex}-${wordIndex}`)}
              onMouseLeave={() => setHoveredLineIndex(null)}
              onClick={() => {
                const selected = getSelectedText();
                if (!selected) {
                  handleWordClick(word);
                }
              }}
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
      );
    });
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