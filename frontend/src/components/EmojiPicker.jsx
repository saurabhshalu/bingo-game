import { useRef, useEffect } from "react";

const ALL_EMOJIS = [
  "😂", "🔥", "👏", "🎉", "😮", "🤯", "🚀", "⚡",
  "🎯", "🏆", "👑", "🐉", "💯", "✨", "🫡", "🤝",
  "❤️", "💔", "😤", "😭", "🥳", "🤩", "😎", "🤠",
  "👻", "💀", "🍀", "🎲", "⭐", "☠️"
];

const EmojiPicker = ({ onPick, onClose, anchorRef }) => {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        if (anchorRef?.current && !anchorRef.current.contains(e.target)) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 bg-neutral-800/95 backdrop-blur-md border border-neutral-600 rounded-xl p-3 shadow-2xl w-52"
      style={{ top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}
    >
      <div className="grid grid-cols-5 gap-1.5">
        {ALL_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            className="text-xl p-1.5 rounded-lg hover:bg-neutral-600/60 transition-colors flex items-center justify-center"
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
