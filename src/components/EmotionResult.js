export default function EmotionResult({ emotion, score }) {
  if (!emotion || !score) return null;

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
      <p className="text-xl text-center text-gray-800">
        <span className="font-bold text-indigo-700">Emotion:</span> {emotion}
      </p>
      <p className="text-xl text-center text-gray-800 mt-2">
        <span className="font-bold text-indigo-700">Confidence:</span> {(score * 100).toFixed(2)}%
      </p>
    </div>
  );
} 