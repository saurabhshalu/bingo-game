import { useContext, useRef, useEffect, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import { motion, AnimatePresence } from "motion/react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "😮"];

const ChatPanel = () => {
  const { chatMessages, sendChatMessage, playerId, players } = useContext(SocketContext);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, showHistory]);

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
    <div className="w-full max-w-2xl mx-auto relative z-20">
      {/* History (expands upward) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 220, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="overflow-hidden bg-neutral-900/95 border-t border-neutral-700"
            style={{ WebkitBackdropFilter: 'blur(8px)' }}
          >
            <div ref={scrollRef} className="h-full overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-neutral-500 text-xs text-center mt-4">No messages yet. Say hi!</p>
              )}
              {chatMessages.map((msg) => {
                const isMe = msg.playerId === playerId;
                const sender = players.find((p) => p.playerId === msg.playerId);
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs break-words leading-relaxed ${
                      isMe ? "bg-green-600/90 text-white rounded-br-sm" : "bg-neutral-700 text-neutral-100 rounded-bl-sm"
                    }`}>
                      <div className="text-[10px] opacity-70 mb-0.5">{sender?.name || "Unknown"}</div>
                      <div>{msg.text}</div>
                    </div>
                    <span className="text-[9px] text-neutral-500 mt-0.5">{formatTime(msg.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showEmoji && (
        <div className="px-3 pt-2 bg-neutral-800/95 border-t border-neutral-700 shrink-0" style={{ WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="flex flex-wrap gap-2 pb-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => insertEmoji(emoji)}
                className="text-lg p-1.5 rounded hover:bg-neutral-700 transition-colors">{emoji}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar (always visible) */}
      <form onSubmit={handleSubmit} className="bg-neutral-800/95 border-t border-neutral-700 px-3 py-2.5 flex items-center gap-2"
        style={{ WebkitBackdropFilter: 'blur(8px)' }}>
        <button type="button" onClick={() => setShowEmoji(!showEmoji)}
          className="text-neutral-400 hover:text-yellow-400 transition-colors p-1.5 rounded hover:bg-neutral-700 shrink-0">😊</button>
        <input ref={inputRef} type="text" placeholder="Type a message..." autoComplete="off"
          className="flex-1 bg-neutral-900/80 text-neutral-100 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-500 placeholder:text-neutral-600"
          maxLength={100} />
        <button type="submit" className="text-green-400 hover:text-green-300 transition-colors px-3 py-2 rounded hover:bg-neutral-700 shrink-0 text-xs font-bold">➤</button>
        <button type="button" onClick={() => setShowHistory(!showHistory)}
          className="text-neutral-400 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-neutral-700 transition-colors shrink-0">
          {showHistory ? "Hide" : "History"}
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
