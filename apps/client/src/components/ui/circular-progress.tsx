interface CircularProgressProps {
  value: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export function CircularProgress({
  value,
  target,
  size = 120,
  strokeWidth = 10
}: CircularProgressProps) {
  const safeTarget = target <= 0 ? 1 : target;
  const percentage = Math.min(100, Math.round((value / safeTarget) * 100));
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="h-full w-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-separator"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-accent transition-all duration-800 ease-out-smooth"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        {/* Central percentage text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tracking-tight text-foreground leading-none">{percentage}%</span>
          <span className="text-[10px] text-muted font-bold mt-1 uppercase">Done</span>
        </div>
      </div>
    </div>
  );
}
