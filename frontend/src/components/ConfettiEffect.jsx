import { useEffect } from "react";
import confetti from "canvas-confetti";

const ConfettiEffect = ({ trigger, mode = "round" }) => {
  useEffect(() => {
    if (!trigger) return;

    const colors = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

    if (mode === "tournament") {
      // Full cannon for tournament champion
      const duration = 4000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } else {
      // Small burst from bottom-center for round win
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors,
        disableForReducedMotion: true,
      });
    }
  }, [trigger, mode]);

  return null;
};

export default ConfettiEffect;
