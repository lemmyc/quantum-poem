'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import SunModel from '../../components/SunModel/SunModel';
import './page.scss';
import HackerStatsPanel from '../../components/HackerStatsPanel';

function FeatureContent() {
  const searchParams = useSearchParams();
  const mainWord = searchParams.get('word');
  const language = searchParams.get('language');
  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState('');
  const [poemDisplay, setPoemDisplay] = useState('');
  const [hoveredWordIdx, setHoveredWordIdx] = useState(null);
  const [sphereToCorner, setSphereToCorner] = useState(false);
  const poemBoxRef = useRef();
  const [extraPoems, setExtraPoems] = useState([]); // mỗi phần tử: {text, top, right}
  const [hoveredExtraPoemWord, setHoveredExtraPoemWord] = useState({ poemIdx: null, wordIdx: null });

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
      const newPoem = data.poem || 'Không thể tạo bài thơ mới';
      setExtraPoems(poems => [
        ...poems,
        { text: newPoem, displayText: '' }
      ]);
    } catch (e) {
      console.error('Error generating poem from SunModel:', e);
      setExtraPoems(poems => [...poems, { text: 'Lỗi khi tạo bài thơ mới!' }]);
    }
  };

  // Hiệu ứng typing cho poem
  useEffect(() => {
    if (!poem) return;
    setPoemDisplay('');
    let i = 0;
    const interval = setInterval(() => {
      setPoemDisplay(poem.slice(0, i + 1));
      i++;
      if (i >= poem.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [poem]);

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

        setKeywords(newSortedWords)
        console.log('Keywords API result:', newSortedWords);
      } catch (err) {
        console.error('Error fetching keywords:', err);
      }
    }
    fetchKeywords();
  }, [mainWord]);

  useEffect(() => {
    if (extraPoems.length === 0) return;
    // Chỉ typing cho poem mới nhất
    const lastIdx = extraPoems.length - 1;
    const poem = extraPoems[lastIdx];
    if (!poem || poem.displayText === poem.text) return;

    let i = 0;
    const interval = setInterval(() => {
      setExtraPoems(poems => {
        const updated = [...poems];
        const current = updated[lastIdx];
        if (current.displayText.length < current.text.length) {
          updated[lastIdx] = {
            ...current,
            displayText: current.text.slice(0, current.displayText.length + 1)
          };
        }
        return updated;
      });
      i++;
      if (i >= poem.text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [extraPoems]);

  return (
    <div className="feature-container">
      {/* Hacker-stats cyber panel góc phải */}
      <HackerStatsPanel />
      {/* 3D Quantum Sphere background */}
      {Array.isArray(keywords) && keywords.length > 0 ? (
        <SunModel
          mainWord={mainWord}
          keywords={keywords}
          onPoem={setPoem}
          sphereToCorner={sphereToCorner}
          onGeneratePoemFromSunModel={handleGeneratePoemFromSunModel}
        />
      ) : (
        <div>Loading...</div>
      )}
      {/* Poem overlay góc trên phải */}
      {poemDisplay && (
        <div
          ref={poemBoxRef}
          style={{
            position: 'fixed',
            top: 24,
            right: "38%",
            minWidth: 320,
            maxWidth: 480,
            background: 'rgba(30,30,30,0.95)',
            color: '#fff',
            borderRadius: 12,
            padding: '20px 28px',
            fontSize: 20,
            fontFamily: 'serif',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            zIndex: 1000,
            whiteSpace: 'pre-line',
            letterSpacing: 0.5,
            border: '1px solid #444',
            animation: 'fadeIn 0.5s'
          }}
        >
          {poemDisplay.split(/(\s+)/).map((word, idx) =>
            word.trim() === '' ? word : (
              <span
                key={idx}
                onMouseEnter={() => setHoveredWordIdx(idx)}
                onMouseLeave={() => setHoveredWordIdx(null)}
                onClick={async () => {
                  setSphereToCorner(true);
                  if (poemBoxRef.current) {
                    poemBoxRef.current.classList.remove('poem-shake');
                    void poemBoxRef.current.offsetWidth;
                    poemBoxRef.current.classList.add('poem-shake');
                  }
                  // Logic này sẽ được thay thế bằng hàm handleGeneratePoemFromSunModel
                  // Cần xem xét lại cách xử lý onClick của span nếu bạn không muốn gọi API 2 lần
                  // hoặc muốn behavior khác.
                  // Hiện tại, tôi sẽ không xóa code này trong lần edit này.
                }}
                style={{
                  color: hoveredWordIdx === idx ? '#FFD700' : undefined,
                  fontWeight: hoveredWordIdx === idx ? 'bold' : undefined,
                  textDecoration: hoveredWordIdx === idx ? 'underline' : undefined,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {word}
              </span>
            )
          )}
        </div>
      )}
      {extraPoems.map((poem, i) => (
        <div
          key={i}
          className="poem-extra"
          style={{
            position: 'fixed',
            top: 120 + i * 100, // mỗi poem cách nhau 100px
            right: "38%",
            minWidth: 320,
            maxWidth: 480,
            background: 'rgba(30,30,30,0.95)',
            color: '#fff',
            borderRadius: 12,
            padding: '20px 28px',
            fontSize: 20,
            fontFamily: 'serif',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            zIndex: 1000,
            whiteSpace: 'pre-line',
            letterSpacing: 0.5,
            border: '1px solid #444',
            animation: 'fadeIn 0.5s'
          }}
        >
          {poem.displayText.split(/(\s+)/).map((word, idx) =>
            word.trim() === '' ? word : (
              <span
                key={idx}
                onMouseEnter={() => setHoveredExtraPoemWord({ poemIdx: i, wordIdx: idx })}
                onMouseLeave={() => setHoveredExtraPoemWord({ poemIdx: null, wordIdx: null })}
                style={{
                  color: (hoveredExtraPoemWord.poemIdx === i && hoveredExtraPoemWord.wordIdx === idx) ? '#FFD700' : undefined,
                  fontWeight: (hoveredExtraPoemWord.poemIdx === i && hoveredExtraPoemWord.wordIdx === idx) ? 'bold' : undefined,
                  textDecoration: (hoveredExtraPoemWord.poemIdx === i && hoveredExtraPoemWord.wordIdx === idx) ? 'underline' : undefined,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {word}
              </span>
            )
          )}
        </div>
      ))}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px);}
          to { opacity: 1; transform: translateY(0);}
        }
        @keyframes shake {
          0% { transform: translate(0, 0);}
          10% { transform: translate(-8px, 0);}
          20% { transform: translate(8px, 0);}
          30% { transform: translate(-8px, 0);}
          40% { transform: translate(8px, 0);}
          50% { transform: translate(-8px, 0);}
          60% { transform: translate(8px, 0);}
          70% { transform: translate(-8px, 0);}
          80% { transform: translate(8px, 0);}
          90% { transform: translate(-8px, 0);}
          100% { transform: translate(0, 0);}
        }
        .poem-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
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