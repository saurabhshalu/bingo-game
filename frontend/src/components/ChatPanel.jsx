import { useContext, useRef, useEffect, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import { motion, AnimatePresence } from "motion/react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "😮"];

const ChatPanel = ({ open, onClose }) => {
  const { chatMessages, sendChatMessage, playerId, players } = useContext(SocketContext);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    if (text?.trim()) { sendChatMessage(text); inputRef.current.value = ""; }
    setShowEmoji(false);
  };

  const insertEmoji = (emoji) => {
    if (inputRef.current) { inputRef.current.value += emoji; inputRef.current.focus(); }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-full sm:w-80 bg-neutral-900 border-l border-neutral-700 flex flex-col z-50"
        >
          <div className="flex items-center justify-between p-3 border-b border-neutral-700 shrink-0">
            <h3 className="text-neutral-100 font-semibold text-sm">Live Chat</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-white text-lg leading-none">×</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
            {chatMessages.length === 0 && (
              <p className="text-neutral-500 text-xs text-center mt-4">No messages yet. Say hi!</p>
            )}
            {chatMessages.map((msg) => {
              const isMe = msg.playerId === playerId;
              const sender = players.find((p) => p.playerId === msg.playerId);
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] px-2 py-1.5 rounded-lg text-xs break-words leading-relaxed ${
                    isMe ? "bg-green-500 text-white rounded-br-sm" : "bg-neutral-700 text-neutral-100 rounded-bl-sm"
                  }`}>
                    <div className="text-[10px] opacity-70 mb-0.5">{sender?.name || "Unknown"}</div>
                    <div>{msg.text}</div>
                  </div>
                  <span className="text-[9px] text-neutral-500 mt-0.5">{formatTime(msg.timestamp)}</span>
                </div>
              );
            })}
          </div>

          {showEmoji && (
            <div className="px-2 pt-2 border-t border-neutral-700 shrink-0">
              <div className="flex flex-wrap gap-1 pb-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => insertEmoji(emoji)}
                    className="text-base p-1 rounded hover:bg-neutral-700 transition-colors">{emoji}</button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-2 border-t border-neutral-700 shrink-0">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowEmoji(!showEmoji)}
                className="text-neutral-400 hover:text-yellow-400 transition-colors p-1 rounded hover:bg-neutral-700 shrink-0">😊</button>
              <input ref={inputRef} type="text" placeholder="Type a message..." autoComplete="off"
                className="flex-1 bg-neutral-800 text-neutral-100 text-xs rounded-md px-2.5 py-2 outline-none focus:ring-1 focus:ring-green-500 placeholder:text-neutral-600"
                maxLength={200} />
              <button type="submit" className="text-green-400 hover:text-green-300 transition-colors p-1.5 rounded hover:bg-neutral-700 shrink-0 text-xs font-bold">➤</button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatPanel;
