import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Unlock, Mail, ShieldCheck, ZoomIn, Eye, Play, Pause, Volume2, Mic, Smile } from "lucide-react";
import { DecryptedMessage, FirestoreMessage, ChatUser } from "../types";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

const base64ToBlob = (base64: string): Blob => {
  try {
    const parts = base64.split(";base64,");
    if (parts.length < 2) return new Blob([], { type: "audio/webm" });
    
    let contentType = parts[0].split(":")[1];
    
    // For iOS and Safari: strip any detailed codec parameters (like codecs=opus) from the mime type
    // This allows Apple's CoreAudio decoder to gracefully fallback to decoding the Opus streams in WebM natively.
    if (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
      if (contentType.includes("webm") && contentType.includes(";")) {
        contentType = "audio/webm";
      }
    } else {
      // General strip to keep it clean
      if (contentType.includes(";")) {
        contentType = contentType.split(";")[0];
      }
    }

    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error("base64ToBlob conversion failed:", e);
    return new Blob([], { type: "audio/webm" });
  }
};

const AudioPlayer = ({ src, duration }: { src: string; duration?: number | null }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [audioUrl, setAudioUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let url = src;
    let isBlobUrl = false;

    if (src.startsWith("data:")) {
      const blob = base64ToBlob(src);
      url = URL.createObjectURL(blob);
      isBlobUrl = true;
    }
    
    setAudioUrl(url);

    return () => {
      if (isBlobUrl) {
        URL.revokeObjectURL(url);
      }
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // In iOS Safari, play must be triggered directly inside a user interaction callback
      // Using a ref on a DOM element rendered in JSX perfectly fulfills this security requirement.
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(err => {
          console.error("Audio playback failed on this device:", err);
        });
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatAudioTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || !totalDuration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = Math.min(Math.max(clickX / width, 0), 1);
    audioRef.current.currentTime = clickPercent * totalDuration;
    setCurrentTime(clickPercent * totalDuration);
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-parchment-dark/30 border border-parchment-border/40 rounded-xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-xs max-w-[240px]">
      {/* Native HTMLAudioElement inside DOM for maximum iOS/Safari trust */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          className="hidden"
          preload="auto"
        />
      )}

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-postal-red hover:bg-postal-darkred text-white flex items-center justify-center transition-all shadow active:scale-95 cursor-pointer shrink-0"
      >
        {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-600 mb-1 font-semibold">
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3 text-postal-red animate-pulse" />
          </span>
          <span>{formatAudioTime(currentTime)} / {formatAudioTime(totalDuration)}</span>
        </div>

        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="h-1 bg-white border border-parchment-border/20 rounded-full overflow-hidden cursor-pointer relative"
        >
          <div
            className="bg-postal-red h-full transition-all duration-75 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface MessageItemProps {
  key?: string;
  message: DecryptedMessage;
  rawFirestoreMessage: FirestoreMessage;
  isSelf: boolean;
  currentUser: ChatUser;
  onImageClick: (url: string) => void;
  senderDisplayName?: string;
}

export default function MessageItem({
  message,
  rawFirestoreMessage,
  isSelf,
  currentUser,
  onImageClick,
  senderDisplayName,
}: MessageItemProps): React.JSX.Element {
  const [showEncrypted, setShowEncrypted] = useState(false);
  const [showMobileReactions, setShowMobileReactions] = useState(false);
  const [showHoverReactions, setShowHoverReactions] = useState(false);
  const longPressTimerRef = useRef<any>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

  // Handle system message rendering
  if (message.isSystem || message.sender === "System") {
    return (
      <div className="flex justify-center my-4 w-full" id={`system-msg-${message.id}`}>
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/15 backdrop-blur-xs border border-slate-800/5 rounded-2xl px-4 py-1.5 text-center text-slate-700 text-[11.5px] font-semibold leading-relaxed shadow-xs max-w-md font-sans"
        >
          {message.text}
        </motion.div>
      </div>
    );
  }

  useEffect(() => {
    if (!showMobileReactions) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowMobileReactions(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showMobileReactions]);

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMobileReactions(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleReact = async (emoji: string) => {
    try {
      const docRef = doc(db, "messages", message.id);
      const existingReactions = rawFirestoreMessage.reactions || {};
      const newReactions = { ...existingReactions };

      if (newReactions[currentUser] === emoji) {
        delete newReactions[currentUser];
      } else {
        newReactions[currentUser] = emoji;
      }

      await updateDoc(docRef, {
        reactions: newReactions,
      });
      setShowMobileReactions(false);
      setShowHoverReactions(false);
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  const reactionsObj = message.reactions || {};
  const hasReactions = Object.keys(reactionsObj).length > 0;

  const emojiCounts: { [emoji: string]: string[] } = {};
  Object.entries(reactionsObj).forEach(([user, emoji]) => {
    if (!emojiCounts[emoji]) {
      emojiCounts[emoji] = [];
    }
    emojiCounts[emoji].push(user);
  });

  // Formatting hours/minutes safely
  const formatTime = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Beautiful postal ink stamp or postmark styles based on Seen / Unseen
  const renderSeenStatus = () => {
    if (!isSelf) return null; // Seen status is displayed on the sender's screen

    if (message.seen) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 select-none shadow-xs" title="চিঠিটি পড়া হয়েছে (Read)">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs border border-emerald-300 animate-pulse shrink-0" />
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 select-none shadow-xs" title="চিঠিটি এখনো পড়া হয়নি (Unread)">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs border border-rose-300 shrink-0" />
        </span>
      );
    }
  };

  return (
    <div className={`flex flex-col ${isSelf ? "items-end" : "items-start"} mb-4 group relative`}>
      {/* Sender Label & Node details */}
      {!isSelf && (
        <span className="text-[10px] font-bold text-slate-500 mb-1 ml-2.5 font-mono uppercase tracking-wider">
          {senderDisplayName || message.sender} • প্রেরক
        </span>
      )}

      {/* Main Mail Container */}
      <div
        ref={bubbleRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onMouseEnter={() => setShowHoverReactions(true)}
        onMouseLeave={() => setShowHoverReactions(false)}
        className="max-w-[85%] sm:max-w-[70%] relative"
      >
        {/* Floating Reaction Picker */}
        <AnimatePresence>
          {(showMobileReactions || showHoverReactions) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className={`absolute -top-11 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-parchment-border/80 px-2 py-1 rounded-full shadow-lg ${
                isSelf ? "right-2" : "left-2"
              }`}
            >
              {EMOJIS.map((emoji) => {
                const hasReacted = message.reactions?.[currentUser] === emoji;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`w-7.5 h-7.5 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all cursor-pointer hover:scale-130 active:scale-90 text-[17px] ${
                      hasReacted ? "bg-postal-red/10 scale-110" : ""
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          className={`rounded-2xl p-3 sm:p-3.5 relative overflow-hidden transition-all duration-300 border shadow-sm ${
            isSelf
              ? showEncrypted
                ? "bg-slate-900 border-slate-700 text-slate-300 font-mono"
                : message.sender === "Saluk"
                ? "bg-[#faf5eb]/95 text-slate-850 border-amber-200/90 shadow-amber-950/5 hover:shadow-md border-l-4 border-l-amber-500/60"
                : "bg-[#f5fbf7]/95 text-slate-850 border-emerald-200/90 shadow-emerald-950/5 hover:shadow-md border-l-4 border-l-emerald-500/60"
              : showEncrypted
              ? "bg-slate-900 border-slate-800 text-emerald-500 font-mono"
              : "bg-white text-slate-900 border-slate-150 shadow-xs hover:shadow-md border-l-4 border-l-slate-400/50"
          }`}
        >
          {/* Authentic retro postage stamp in top corner */}
          {!showEncrypted && (
            <div 
              className={`absolute top-2 right-2 w-9 h-11 bg-amber-50/95 border border-dashed border-amber-500/70 rounded flex flex-col items-center justify-between p-1 select-none pointer-events-none shadow-3xs hover:scale-105 transition-transform duration-300 ${
                isSelf ? "rotate-3" : "-rotate-3"
              }`}
            >
              {/* Stamp Crest details */}
              <div className="text-[5px] font-serif font-black text-amber-800/80 tracking-widest leading-none">POSTAGE</div>
              <div className="w-5.5 h-5.5 rounded-sm bg-amber-100 flex items-center justify-center border border-amber-200/60 overflow-hidden">
                <span className="text-[10px] leading-none">
                  {message.imageUrl ? "🖼️" : message.audioUrl ? "🎵" : isSelf ? "🕊️" : "✉️"}
                </span>
              </div>
              <div className="text-[5px] font-mono font-bold text-amber-800/85 leading-none">৳ ১০.০০</div>
              {/* Overlapping wavy circular post office cancel ink lines */}
              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                <div className="w-7 h-7 rounded-full border border-dashed border-slate-700/60 flex items-center justify-center">
                  <span className="text-[3px] font-mono font-black text-slate-800 rotate-12">GPO</span>
                </div>
              </div>
            </div>
          )}

          {/* Decrypted content or raw encrypted Firestore ciphertext */}
          <AnimatePresence mode="wait">
            {showEncrypted ? (
              <motion.div
                key="encrypted"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[10px] leading-relaxed break-all select-all flex flex-col gap-2 pt-2 pr-10"
              >
                <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-1.5 mb-1 font-bold">
                  <Lock className="w-3 h-3 text-postal-red" />
                  <span>গোপন চিঠি সংকেত</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">text:</span> {rawFirestoreMessage.text}
                </div>
                {rawFirestoreMessage.imageUrl && (
                  <div>
                    <span className="text-slate-500 font-semibold">img:</span>{" "}
                    {rawFirestoreMessage.imageUrl.substring(0, 40)}...
                  </div>
                )}
                {rawFirestoreMessage.audioUrl && (
                  <div>
                    <span className="text-slate-500 font-semibold">audio:</span>{" "}
                    {rawFirestoreMessage.audioUrl.substring(0, 40)}...
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="decrypted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 pr-10"
              >
                {/* Message body in clean elegant Bengali script/handwriting font styles */}
                {message.text && !message.audioUrl && (
                  <p className="leading-relaxed whitespace-pre-wrap font-serif text-[14px] sm:text-[14.5px] text-slate-800 tracking-wide font-medium">
                    {message.text}
                  </p>
                )}

                {/* Secure decrypted voice messages */}
                {message.audioUrl && (
                  <AudioPlayer src={message.audioUrl} duration={message.audioDuration} />
                )}

                {/* Secure attached images/stamps */}
                {message.imageUrl && (
                  <div className="relative mt-2.5 rounded-xl overflow-hidden group/image border border-parchment-border bg-slate-100 shadow-inner">
                    <img
                      src={message.imageUrl}
                      alt={message.fileName || "Shared attachment"}
                      referrerPolicy="no-referrer"
                      className="max-h-48 sm:max-h-56 w-full object-cover cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                      onClick={() => onImageClick(message.imageUrl!)}
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => onImageClick(message.imageUrl!)}
                        className="p-2 bg-white rounded-full text-slate-800 shadow-md hover:bg-parchment-dark hover:scale-105 active:scale-95 transition-all cursor-pointer border border-parchment-border"
                        title="চিঠির ছবি বড় করুন"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time & Delivery Checkmarks and Seen / Unseen stamp indicators */}
          <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-slate-500 font-mono border-t border-dashed border-slate-200/80 pt-2.5">
            <span>{formatTime(message.timestamp)}</span>
            
            <div className="flex items-center gap-2">
              {/* E2EE delivery confirmation locks */}
              {isSelf && (
                <span className="text-emerald-700 shrink-0" title="সুরক্ষিত চিঠি (E2EE Active)">
                  <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                </span>
              )}
              {/* Seen / Unseen stamps */}
              {renderSeenStatus()}
            </div>
          </div>
        </motion.div>

        {/* Reaction Pill Display */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isSelf ? "justify-end" : "justify-start"}`}>
            {Object.entries(emojiCounts).map(([emoji, users]) => {
              const hasCurrentUserReacted = users.includes(currentUser);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full select-none border transition-all cursor-pointer shadow-xs ${
                    hasCurrentUserReacted
                      ? "bg-postal-red/10 border-postal-red/30 text-postal-red font-bold scale-102"
                      : "bg-white border-parchment-border text-slate-600 hover:bg-slate-50"
                  }`}
                  title={`${users.join(", ")} reacted with ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[9px] opacity-80 font-bold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hover / Absolute Toggle Encrypted Cipher Code Key & Reaction trigger */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${
            isSelf ? "-left-24 pr-2" : "-right-24 pl-2"
          }`}
        >
          <button
            onClick={() => setShowEncrypted(!showEncrypted)}
            className="p-2 rounded-xl bg-parchment-light border border-parchment-border text-slate-500 hover:text-slate-800 hover:border-slate-400 shadow-md transition-all cursor-pointer shrink-0"
            title={showEncrypted ? "চিঠি পড়ুন" : "এনক্রিপশন দেখুন"}
          >
            {showEncrypted ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <button
            onClick={() => setShowMobileReactions(!showMobileReactions)}
            className="p-2 rounded-xl bg-parchment-light border border-parchment-border text-slate-500 hover:text-slate-800 hover:border-slate-400 shadow-md transition-all cursor-pointer shrink-0"
            title="প্রতিক্রিয়া দিন"
          >
            <Smile className="w-3.5 h-3.5 text-amber-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
