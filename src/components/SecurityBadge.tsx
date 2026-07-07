import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Key, Lock, Eye, EyeOff, X } from "lucide-react";

interface SecurityBadgeProps {
  currentUser: string;
}

export default function SecurityBadge({ currentUser }: SecurityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [revealKey, setRevealKey] = useState(false);

  const keyString = "Saluk-Digonto-E2EE-Shared-Secret-2026-Super-Secure";
  const maskedKey = "••••••••••••••••••••••••••••••••••••••••••••••••••••";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15 transition-all text-[11px] cursor-pointer font-medium shadow-sm"
      >
        <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
        <span>সুরক্ষিত</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Click-out overlay with soft blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl font-sans text-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="font-bold text-sm tracking-wide font-serif text-slate-250">
                    নিরাপত্তা ও এনক্রিপশন
                  </h4>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                  <span className="text-slate-400 font-mono text-[10px]">অ্যালগরিদম</span>
                  <span className="font-mono text-emerald-400 font-bold text-[11px]">AES-255 GCM / CBC</span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                  <span className="text-slate-400 font-mono text-[10px]">কি-এক্সচেঞ্জ</span>
                  <span className="font-mono text-indigo-400 font-bold text-[11px]">P2P হ্যান্ডশেক</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] flex items-center gap-1.5 font-medium">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      মেমোরি ক্রিপ্ট-কি (E2EE Secret)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealKey(!revealKey)}
                      className="text-slate-400 hover:text-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer underline"
                    >
                      {revealKey ? "লুকান (Hide)" : "দেখান (Reveal)"}
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-[10px] break-all text-slate-300 relative select-all leading-normal">
                    {revealKey ? keyString : maskedKey}
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3 text-center sm:text-left">
                  প্রতিটি বার্তা ফায়ারস্টোরে পাঠানোর পূর্বে আপনার ডিভাইসে AES-256 দ্বারা সুরক্ষিতভাবে এনক্রিপ্ট করা হয়। কেবল এই চ্যাটের অংশীদারের কাছে থাকা গোপন কি দিয়েই চিঠিটি পড়া সম্ভব।
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
