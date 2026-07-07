import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Image, Key, HelpCircle, Check, AlertTriangle, ExternalLink } from "lucide-react";

interface ImgBBSettingsProps {
  onKeyChange: (newKey: string) => void;
  currentKey: string;
}

export default function ImgBBSettings({ onKeyChange, currentKey }: ImgBBSettingsProps) {
  const [apiKey, setApiKey] = useState(currentKey);
  const [isSaved, setIsSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setApiKey(currentKey);
  }, [currentKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    onKeyChange(trimmed);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl max-w-sm w-full">
      <div className="flex items-center gap-2.5 mb-4 border-b border-slate-800/80 pb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Image className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-slate-100">ইমেজ আপলোড সেটিংস</h3>
          <p className="text-[10px] text-slate-400">ছবি আদান-প্রদানের জন্য প্রয়োজনীয় (ImgBB)</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Key className="w-3 h-3 text-emerald-400" />
              এপিআই কি (API Key)
            </label>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-0.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              কীভাবে পাবেন?
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="আপনার ImgBB API Key পেস্ট করুন..."
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all font-mono text-xs"
            />
          </div>
        </div>

        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 space-y-2 font-sans"
          >
            <p className="font-medium text-slate-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              ধাপসমূহ:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              <li>
                <a
                  href="https://imgbb.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  imgbb.com <ExternalLink className="w-2.5 h-2.5" />
                </a>{" "}
                এ গিয়ে লগইন বা সাইন-আপ করুন।
              </li>
              <li>
                <a
                  href="https://api.imgbb.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  api.imgbb.com <ExternalLink className="w-2.5 h-2.5" />
                </a>{" "}
                লিংকে প্রবেশ করুন।
              </li>
              <li>"Create API Key" বাটনে ক্লিক করে টোকেনটি কপি করুন।</li>
              <li>কপি করা টোকেনটি উপরের কি-বক্সে পেস্ট করে সেভ করুন!</li>
            </ol>
          </motion.div>
        )}

        <button
          type="submit"
          className={`w-full py-2 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isSaved
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-200 hover:bg-slate-750 active:scale-95 border border-slate-700/40"
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>এপিআই কি সংরক্ষিত হয়েছে!</span>
            </>
          ) : (
            <span>এপিআই কি সংরক্ষণ করুন</span>
          )}
        </button>
      </form>
    </div>
  );
}
