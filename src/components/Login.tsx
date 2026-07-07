import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight, Mail, Key } from "lucide-react";
import { ChatUser } from "../types";

interface LoginProps {
  onLoginSuccess: (user: ChatUser) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [selectedUser, setSelectedUser] = useState<ChatUser>("Saluk");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // High-security user credential references (Saluk & Digonto only)
  const USERS = {
    Saluk: {
      password: "Saluk1470",
      themeBg: "bg-[#faf5eb] border-amber-300",
      accentText: "text-postal-red",
      stampVal: "14Tk",
      description: "প্রেরক নোড: আলফা (Alpha Node)",
    },
    Digonto: {
      password: "14702580",
      themeBg: "bg-[#f5fbf7] border-emerald-300",
      accentText: "text-emerald-800",
      stampVal: "25Tk",
      description: "প্রেরক নোড: বিটা (Beta Node)",
    },
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Cryptographic unsealing simulation
    setTimeout(() => {
      const correctPassword = USERS[selectedUser].password;
      if (password === correctPassword) {
        onLoginSuccess(selectedUser);
      } else {
        setError("গোপন পাসওয়ার্ডটি সঠিক নয় (Cryptographic Authentication Failed)");
        setIsSubmitting(false);
      }
    }, 150);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2e7d5] px-4 py-12 relative overflow-hidden font-sans">
      
      {/* Postal background textures */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4),transparent)] z-0" />
      
      {/* Decorative airmail border lines at top and bottom */}
      <div className="absolute top-0 left-0 right-0 h-2.5 airmail-stripes z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-2.5 airmail-stripes z-10" />

      {/* Floating retro stamp illustrations */}
      <div className="absolute top-12 left-12 w-28 h-28 bg-[#faf4e8]/60 border border-dashed border-amber-800/25 rounded-xl hidden lg:flex flex-col items-center justify-center p-2 opacity-50 rotate-12 select-none">
        <span className="font-serif font-bold text-xs text-amber-900/50">DACCA 1854</span>
        <div className="w-14 h-14 rounded-full border border-dashed border-amber-900/40 flex items-center justify-center mt-1">
          <span className="text-[8px] font-mono font-bold text-amber-900/50">POSTAGE</span>
        </div>
      </div>

      <div className="absolute bottom-16 right-16 w-32 h-24 bg-[#faf4e8]/60 border border-dashed border-amber-800/25 rounded-xl hidden lg:flex flex-col items-center justify-center p-2 opacity-50 -rotate-12 select-none">
        <span className="font-serif font-bold text-[10px] text-amber-900/50">G.P.O. DAKGHOR</span>
        <div className="w-20 h-10 border border-amber-900/30 flex items-center justify-center mt-2">
          <span className="text-[7px] font-mono text-amber-900/50 tracking-widest">BETA V - 19s</span>
        </div>
      </div>

      {/* Main interactive Envelope container */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-md bg-white border border-[#d5c39c] rounded-3xl p-8 shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Envelope top triangle simulation line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />

        {/* Header - Postal Seal Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <motion.div
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="w-16 h-16 rounded-full bg-postal-red flex items-center justify-center shadow-lg border-4 border-white text-white relative mb-4"
          >
            {/* Wax seal effect */}
            <Mail className="w-7 h-7" />
            <div className="absolute inset-0.5 rounded-full border-2 border-dashed border-white/20 pointer-events-none" />
          </motion.div>
          
          <h1 className="text-2xl font-serif font-extrabold text-slate-900 tracking-tight">
            ডাকঘর <span className="text-postal-red font-mono">Beta V</span>
          </h1>
          <p className="text-[11px] text-slate-500 font-mono uppercase tracking-widest mt-1">
            সুরক্ষিত চিঠি যোগাযোগ (Secure Mail Network)
          </p>
        </div>

        {/* Identity selector - choose Saluk or Digonto as letter author */}
        <div className="mb-7">
          <label className="block text-xs font-mono font-bold text-slate-500 mb-2.5 uppercase tracking-wider">
            চিঠি প্রেরক নির্বাচন করুন (Select Identity)
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(["Saluk", "Digonto"] as ChatUser[]).map((user) => {
              const active = selectedUser === user;
              const props = USERS[user];
              return (
                <button
                  key={user}
                  type="button"
                  onClick={() => {
                    setSelectedUser(user);
                    setError(null);
                  }}
                  className={`relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                    active
                      ? `${props.themeBg} border-postal-red shadow-md shadow-amber-900/5`
                      : "border-slate-100 bg-slate-50/50 text-slate-500 hover:border-slate-200 hover:text-slate-800"
                  }`}
                >
                  {/* Miniature Postage Stamp icon */}
                  <div className="absolute top-2 right-2 w-7 h-9 bg-[#fdfaf2] border border-dashed border-amber-300 rounded flex flex-col items-center justify-between p-0.5 select-none pointer-events-none scale-75 opacity-70">
                    <span className="text-[4px] font-bold text-amber-900">19s</span>
                    <span className="text-[4.5px] font-mono font-bold text-postal-red">{props.stampVal}</span>
                  </div>

                  <div className={`w-10 h-10 rounded-xl bg-parchment-dark border border-parchment-border flex items-center justify-center font-serif font-bold text-lg mb-2 text-slate-800`}>
                    {user[0]}
                  </div>
                  
                  <span className="font-serif font-bold text-sm text-slate-900">{user}</span>
                  <span className="text-[9px] text-slate-500 font-mono mt-1 text-center leading-tight">
                    {props.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secret passphrase input */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wider">
              চিঠির বাক্সের গোপন পাসওয়ার্ড (Passphrase)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`${selectedUser} এর গোপন কী লিখুন...`}
                disabled={isSubmitting}
                className="w-full bg-slate-50 border border-slate-200 focus:border-postal-red rounded-xl py-3 pl-4 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-postal-red/10 transition-all font-mono text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Secure Error Logs */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 text-xs font-mono"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sealed Button dispatch */}
          <button
            type="submit"
            disabled={isSubmitting || !password}
            className={`w-full py-3.5 rounded-xl font-serif font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
              isSubmitting || !password
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-postal-red hover:bg-postal-darkred text-white hover:scale-[1.01] active:scale-95 shadow-red-900/10"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>সংযোগ স্থাপন করা হচ্ছে...</span>
              </div>
            ) : (
              <>
                <span>চিঠির বাক্স খুলুন (Unseal Mailbox)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info label */}
        <div className="mt-8 border-t border-slate-150 pt-4 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-postal-red" />
            <span>নিরাপত্তা: AES-256 E2E</span>
          </div>
          <div>ডাকঘর Beta V @ 19s</div>
        </div>
      </motion.div>
    </div>
  );
}
