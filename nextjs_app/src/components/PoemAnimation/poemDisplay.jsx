import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from './poemDisplay.module.scss';

const PoemDisplay = ({ text, onWordClick }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50); // Tốc độ xuất hiện của mỗi ký tự (50ms)

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  // Reset animation khi text mới được truyền vào
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  const handleWordClick = (word) => {
    if (onWordClick) {
      onWordClick(word);
    }
  };

  const renderPoem = () => {
    // Tách text thành các dòng dựa trên \n
    const lines = displayedText.split('\n');
    
    return lines.map((line, lineIndex) => (
      <div key={lineIndex} style={{ marginBottom: '1rem' }}>
        {line.split(' ').map((word, wordIndex) => (
          <span 
            key={`${lineIndex}-${wordIndex}`} 
            className={styles.word}
            onClick={() => handleWordClick(word)}
          >
            {word}
          </span>
        ))}
      </div>
    ));
  };

  return (
    <div className={styles['poem-stats-panel']}>
      {renderPoem()}
    </div>
  );
};

export default PoemDisplay;