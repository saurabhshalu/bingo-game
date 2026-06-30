import { useEffect, useState } from "react";

const TurnTimer = ({ deadline, size = 58, strokeWidth = 3 }) => {
  const [progress, setProgress] = useState(1);
  const [remaining, setRemaining] = useState(30000);

  useEffect(() => {
    if (!deadline) {
      setProgress(1);
      setRemaining(30000);
      return;
    }
    const total = 30000;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, deadline - now);
      setProgress(rem / total);
      setRemaining(rem);
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [deadline]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const color = remaining < 5000 ? "#EF4444" : remaining < 15000 ? "#EAB308" : "#22C55E";

  return (
    <svg
      width={size}
      height={size}
      className="absolute -top-1 -left-1 -rotate-90 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease" }}
      />
    </svg>
  );
};

export default TurnTimer;
