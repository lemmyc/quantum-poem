'use client';

import { useSearchParams } from 'next/navigation';

export default function QuantumPoetryPage() {
  const searchParams = useSearchParams();
  const language = searchParams.get('lang');

  const getLanguageName = (lang) => {
    const languages = {
      'vi': 'Tiếng Việt',
      'en': 'English',
      'fr': 'Français'
    };
    return languages[lang] || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Quantum Poetry
          </h1>
          <p className="text-lg text-gray-600">
            Selected Language: {getLanguageName(language)}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8">
          <p className="text-center text-gray-700">
            Quantum poetry content will be displayed here...
          </p>
        </div>
      </div>
    </div>
  );
} 