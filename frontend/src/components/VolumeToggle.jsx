import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { audioManager } from "../helper/audio.js";

const VolumeToggle = () => {
  const [muted, setMuted] = useState(() => audioManager.muted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    audioManager.setMuted(next);
  };

  return (
    <button
      onClick={() => { audioManager.resumeContext(); toggle(); }}
      className="fixed top-4 right-4 z-40 bg-neutral-700/50 hover:bg-neutral-600/50 text-white p-2 rounded-full transition-colors"
      title={muted ? "Unmute" : "Mute"}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
};

export default VolumeToggle;
