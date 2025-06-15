'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import SunModel from '../../components/SunModel/SunModel';
import './page.scss';
import HackerStatsPanel from '../../components/HackerStatsPanel';
import PoemDisplay from '../../components/PoemAnimation/poemDisplay';

function FeatureContent() {
  const searchParams = useSearchParams();
  const mainWord = searchParams.get('word');
  const language = searchParams.get('language');
  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState({ text: '', animate: false }); // Bài thơ chính: text và trạng thái animate
  const [hoveredWordIdx, setHoveredWordIdx] = useState(null); // Cho bài thơ chính
  const [sphereToCorner, setSphereToCorner] = useState(false);
  const poemBoxRef = useRef();
  const [extraPoems, setExtraPoems] = useState([]); // mỗi phần tử: {text, animate}
  const [hoveredExtraPoemWord, setHoveredExtraPoemWord] = useState({ poemIdx: null, wordIdx: null });
  const [mainError, setMainError] = useState(null); // Define mainError state
  const [pendingPoem, setPendingPoem] = useState(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleGeneratePoemFromSunModel = async (subWord) => {
    if (!mainWord) return;
    try {
      const res = await fetch('/api/generatePoem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainWord: mainWord,
          subWord: subWord,
          emotion: "sad",
          language: "vietnamese"
        }),
      });
      const data = await res.json();
      const newPoemText = data.poem || 'Không thể tạo bài thơ mới';
      setExtraPoems([{ text: newPoemText, animate: false }]);
      setTimeout(() => {
        setExtraPoems([{ text: newPoemText, animate: true }]);
      }, 30);
    } catch (e) {
      console.error('Error generating poem from SunModel:', e);
      setExtraPoems([{ text: 'Lỗi khi tạo bài thơ mới!', animate: true }]);
    }
  };

  useEffect(() => {
    async function fetchKeywords() {
      if (!mainWord) return;
      try {
        const keywordsResponse = await fetch('/api/generateKeywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputText: mainWord, emotion: 'happy' }),
        });
        const tenWords = await keywordsResponse.json();

        const probResponse = await fetch('/api/getWordProbabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: tenWords.keywords }),
        });
        if (!probResponse.ok) {
          const errorData = await probResponse.json();
          throw new Error(errorData.error || 'Unable to get new keyword probabilities.');
        }
        const probData = await probResponse.json();
  
        const newSortedWords = (probData.results || [])
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 4)
          .map(item => ({ word: item.word, probability: item.probability }));
  
        if (newSortedWords.length === 0) {
            setMainError("Could not determine relevant keywords from the generated list. Please try again.");
            return;
        }

        setKeywords(newSortedWords);
        console.log('Keywords API result:', newSortedWords);
      } catch (err) {
        console.error('Error fetching keywords:', err);
        setMainError('Error fetching keywords: ' + err.message);
      }
    }
    fetchKeywords();
  }, [mainWord]);

  return (
    <div className="feature-container">
      {/* Hacker-stats cyber panel góc phải */}
      <HackerStatsPanel />
      {/* 3D Quantum Sphere background */}
      {Array.isArray(keywords) && keywords.length > 0 ? (
        <SunModel
          mainWord={mainWord}
          keywords={keywords}
          onPoem={(newPoemText) => setPoem({ text: newPoemText, animate: false })} // Bài thơ chính không animation
          sphereToCorner={sphereToCorner}
          onGeneratePoemFromSunModel={handleGeneratePoemFromSunModel}
        />
      ) : (
        <div>Loading...</div>
      )}
    

      {/* Hiển thị các bài thơ phụ */}
      {extraPoems.map((poemItem, i) => (
            <PoemDisplay 
              text={poemItem.text} 
              key={i}
              onWordClick={async (word) => {
                try {
                  const res = await fetch('/api/generatePoem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      mainWord: mainWord,
                      subWord: word,
                      emotion: "sad",
                      language: "vietnamese"
                    }),
                  });
                  const data = await res.json();
                  const newPoemText = data.poem || 'Không thể tạo bài thơ mới';
                  setExtraPoems([{ text: newPoemText, animate: false }]);
                  setTimeout(() => {
                    setExtraPoems([{ text: newPoemText, animate: true }]);
                  }, 30);
                } catch (e) {
                  console.error('Error generating poem from word click:', e);
                  setExtraPoems([{ text: 'Lỗi khi tạo bài thơ mới!', animate: true }]);
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