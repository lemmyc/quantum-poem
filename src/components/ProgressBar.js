export default function ProgressBar({ progressItems }) {
  if (progressItems.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-gray-600 font-medium">Loading model files...</p>
      {progressItems.map((item) => (
        <div key={item.file} className="mt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-600 truncate flex-1">{item.file}</span>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {typeof item.progress === 'number' ? item.progress.toFixed(2) : 0}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
} 