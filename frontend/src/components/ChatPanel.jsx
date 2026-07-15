import { useContext, useRef, useEffect, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Plus, X } from "lucide-react";

const DEFAULT_QUICK_CHATS = [
  "Noooo 🙈", "Jaldi aaja! 🏃", "Hell yeah! 🎉",
  "GG 👏", "Oof 😬", "Nice one! 👍",
  "Next round! 🚀", "I'm on fire 🔥", "Kaash I won 😭"
];

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "😮"];

const ChatPanel = () => {
  const { chatMessages, sendChatMessage, playerId, players } = useContext(SocketContext);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const quickInputRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [quickChats, setQuickChats] = useState(() => {
    try {
      const saved = localStorage.getItem("bingo_quick_chats");
      return saved ? JSON.parse(saved) : [...DEFAULT_QUICK_CHATS];
    } catch {
      return [...DEFAULT_QUICK_CHATS];
    }
  });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickEditMode, setQuickEditMode] = useState(false);

  useEffect(() => {
    localStorage.setItem("bingo_quick_chats", JSON.stringify(quickChats));
  }, [quickChats]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, showHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    if (text?.trim()) {
      sendChatMessage(text);
      inputRef.current.value = "";
      inputRef.current.blur();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setShowEmoji(false);
  };

  const sendQuickChat = (text) => {
    sendChatMessage(text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addQuickChat = () => {
    const text = quickInputRef.current?.value?.trim().slice(0, 100);
    if (!text) return setShowQuickAdd(false);
    if (quickChats.length >= 10) {
      alert("Maximum 10 quick chat messages allowed. Remove one to add another.");
      return setShowQuickAdd(false);
    }
    if (quickChats.includes(text)) {
      setShowQuickAdd(false);
      return;
    }
    setQuickChats((prev) => [...prev, text]);
    quickInputRef.current.value = "";
    setShowQuickAdd(false);
  };

  const removeQuickChat = (text) => {
    setQuickChats((prev) => prev.filter((q) => q !== text));
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
      {/* History overlay above the board */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 right-0 mb-2 z-30 bg-neutral-900/95 border border-neutral-600 rounded-t-xl overflow-hidden shadow-2xl"
            style={{ height: 'min(50dvh, 300px)', WebkitBackdropFilter: 'blur(8px)' }}
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

      {/* Quick chats row */}
      <div className="bg-neutral-800/80 border-t border-neutral-700 px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {quickChats.map((text) => (
            <div key={text} className="relative shrink-0 group">
              <button
                onClick={() => sendQuickChat(text)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-neutral-700/80 hover:bg-neutral-600 text-neutral-200 transition-colors whitespace-nowrap"
              >
                {text}
              </button>
              {quickEditMode && (
                <button
                  onClick={() => removeQuickChat(text)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px]"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}

          {showQuickAdd ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={quickInputRef}
                type="text"
                placeholder="Your phrase..."
                autoFocus
                maxLength={100}
                className="bg-neutral-900 text-white text-[11px] rounded-full px-2.5 py-1 outline-none border border-neutral-600 w-28"
                onKeyDown={(e) => { if (e.key === "Enter") addQuickChat(); }}
              />
              <button onClick={addQuickChat} className="text-green-400 hover:text-green-300 text-xs p-1">
                <Plus size={14} />
              </button>
              <button onClick={() => setShowQuickAdd(false)} className="text-neutral-400 hover:text-white text-xs p-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowQuickAdd(true)}
              disabled={quickChats.length >= 10}
              className="shrink-0 text-[11px] px-2 py-1 rounded-full border border-dashed border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors flex items-center gap-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={10} /> Add
            </button>
          )}

          <button
            onClick={() => setQuickEditMode(!quickEditMode)}
            className={`shrink-0 text-[10px] px-2 py-1 rounded-full transition-colors ml-1 ${
              quickEditMode ? "bg-red-500/20 text-red-400" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {quickEditMode ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* Input bar (always visible) */}
      <form onSubmit={handleSubmit} className="bg-neutral-800/95 border-t border-neutral-700 px-3 py-2.5 flex items-center gap-2"
        style={{ WebkitBackdropFilter: 'blur(8px)' }}>
        <button type="button" onClick={() => setShowEmoji(!showEmoji)}
          className="text-neutral-400 hover:text-yellow-400 transition-colors p-1.5 rounded hover:bg-neutral-700 shrink-0">😊</button>
        <input ref={inputRef} type="text" placeholder="Type a message..." autoComplete="off"
          enterKeyHint="send"
          className="flex-1 bg-neutral-900/80 text-neutral-100 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-500 placeholder:text-neutral-600"
          maxLength={100} />
        <button type="submit" className="text-green-400 hover:text-green-300 transition-colors px-3 py-2 rounded hover:bg-neutral-700 shrink-0 text-xs font-bold">➤</button>
        <button type="button" onClick={() => setShowHistory(!showHistory)}
          className={`transition-colors p-1.5 rounded hover:bg-neutral-700 shrink-0 ${showHistory ? "text-green-400" : "text-neutral-400 hover:text-white"}`}
          title={showHistory ? "Hide history" : "Show history"}>
          <MessageSquare size={16} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
