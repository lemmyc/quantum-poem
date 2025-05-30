'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ElectronOrbit = dynamic(() => import('@/components/ElectronOrbit'), {
  ssr: false,
  loading: () => <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading 3D...</div>
});

export default function FeaturePage() {
  const searchParams = useSearchParams();
  const word = searchParams.get('word');
  const language = searchParams.get('language');
  const [keywords, setKeywords] = useState(null);
  const [poem, setPoem] = useState('');
  const [poemDisplay, setPoemDisplay] = useState('');

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
      if (!word) return;
      try {
        const keywordsResponse = await fetch('/api/generateKeywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputText: word, emotion: 'happy' }),
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
  }, [word]);

  return (
    <div className="relative min-h-screen">
      {/* 3D Quantum Sphere background */}
      <ElectronOrbit keywords={keywords} onPoem={setPoem} />
      {/* Poem overlay góc trên phải */}
      {poemDisplay && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 32,
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
        }}>
          {poemDisplay}
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px);}
          to { opacity: 1; transform: translateY(0);}
        }
      `}</style>
    </div>
  );
} 