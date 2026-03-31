'use client';

interface ProgressBarProps {
  message: string;
  progress: number;
  color?: string;
  detail?: string;
}

/**
 * Shared progress bar — used for both ingestion and evaluation tracking.
 */
export function ProgressBar({ message, progress, color = 'bg-blue-600', detail }: ProgressBarProps) {
  return (
    <div className="glass rounded-xl p-6 border border-white/5 space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase" style={{ color: 'inherit' }}>
        <span>{message}</span>
        <span>{detail || `${progress}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-dark-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
