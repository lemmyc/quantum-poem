export default function ProgressBar({ progressItems }) {
  if (progressItems.length === 0) return null;

  return (
    <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
      <p className="text-sm text-blue-700 font-medium mb-2">Loading model files...</p>
      {progressItems.map((item) => (
        <div key={item.file} className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-blue-600 truncate flex-1">{item.file}</span>
            <span className="text-xs text-blue-600 whitespace-nowrap">
              {typeof item.progress === 'number' ? item.progress.toFixed(0) : 0}%
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
} 