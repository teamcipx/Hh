import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  LogOut,
  Send,
  Image as ImageIcon,
  Shield,
  Loader2,
  Settings,
  X,
  Mail,
  CheckCircle,
  Clock,
  Inbox,
  AlertCircle,
  Compass,
  FileText,
  Bell,
  Mic,
  Palette,
  User,
  Volume2,
} from "lucide-react";
import { db } from "../firebase";
import { ChatUser, FirestoreMessage, DecryptedMessage, UserStatus } from "../types";
import { encryptText, decryptText } from "../cryptoUtils";
import MessageItem from "./MessageItem";
import SecurityBadge from "./SecurityBadge";
import ImgBBSettings from "./ImgBBSettings";
import { playPostalChime, playSmsSound } from "../audioUtils";

interface ChatWindowProps {
  currentUser: ChatUser;
  onLogout: () => void;
}

export default function ChatWindow({ currentUser, onLogout }: ChatWindowProps) {
  const [messages, setMessages] = useState<{ raw: FirestoreMessage; decrypted: DecryptedMessage }[]>([]);
  const [text, setText] = useState("");
  const [imgbbKey, setImgbbKey] = useState<string>(() => {
    return localStorage.getItem("imgbb_api_key") || "";
  });
  const [showImgbbSettings, setShowImgbbSettings] = useState(false);
  
  // Shared config & nickname settings states
  const [paperTexture, setPaperTexture] = useState<"parchment" | "airmail" | "telegram" | "velvet" | "forest" | "midnight" | "rose">("parchment");
  const [sharedConfig, setSharedConfig] = useState<{
    paperTexture?: "parchment" | "airmail" | "telegram" | "velvet" | "forest" | "midnight" | "rose";
    nicknames?: { Saluk?: string; Digonto?: string };
  }>({});
  const [nicknameInput, setNicknameInput] = useState("");
  const [isNicknameSaved, setIsNicknameSaved] = useState(false);

  // Notification sound settings (Vintage postal chime vs modern digital SMS sound)
  const [notificationSound, setNotificationSound] = useState<"postal" | "sms">(() => {
    return (localStorage.getItem("notification_sound") as "postal" | "sms") || "sms";
  });

  // Subscribe to shared settings configuration (theme sync and nicknames)
  useEffect(() => {
    const configRef = doc(db, "settings", "shared_config");
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSharedConfig(data);
        if (data.paperTexture) {
          setPaperTexture(data.paperTexture);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize nickname input field
  useEffect(() => {
    if (sharedConfig.nicknames?.[currentUser]) {
      setNicknameInput(sharedConfig.nicknames[currentUser] || "");
    }
  }, [sharedConfig, currentUser]);

  const updateSharedTexture = async (newTexture: "parchment" | "airmail" | "telegram" | "velvet" | "forest" | "midnight" | "rose") => {
    setPaperTexture(newTexture);
    try {
      const configRef = doc(db, "settings", "shared_config");
      await setDoc(configRef, { 
        paperTexture: newTexture,
        lastThemeUpdater: currentUser,
        lastThemeUpdatedAt: serverTimestamp()
      }, { merge: true });

      // Get readable theme name in Bengali
      const themeNames: { [key: string]: string } = {
        parchment: "প্রাচীন পার্চমেন্ট (Aged Parchment)",
        airmail: "বিমান ডাক খাম (Airmail)",
        telegram: "টেলিগ্রাম কাগজ (Telegram Paper)",
        velvet: "রাজকীয় মখমল (Royal Velvet)",
        forest: "বনলতা সবুজ (Forest Moss)",
        midnight: "রাতের আকাশ (Midnight Celestial)",
        rose: "গোলাপী চিঠি (Vintage Rose)"
      };

      const systemMessage = `🎨 ${currentUserDisplayName} চ্যাট ব্যাকগ্রাউন্ড থিম পরিবর্তন করে "${themeNames[newTexture] || newTexture}" করেছেন`;

      await addDoc(collection(db, "messages"), {
        sender: "System",
        text: systemMessage,
        timestamp: serverTimestamp(),
        hasAttachment: false,
        seen: true,
        isSystem: true
      });
    } catch (e) {
      console.error("Error updating shared paper texture:", e);
    }
  };

  const saveNickname = async () => {
    const trimmed = nicknameInput.trim();
    try {
      const configRef = doc(db, "settings", "shared_config");
      await setDoc(
        configRef,
        {
          nicknames: {
            [currentUser]: trimmed || currentUser
          },
          lastNicknameUpdater: currentUser,
          lastNicknameUpdatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Also add a system log message in the messages collection!
      const systemMessage = trimmed 
        ? `✍️ ${currentUserDisplayName} তাঁর নিকনেম পরিবর্তন করে "${trimmed}" রেখেছেন`
        : `✍️ ${currentUserDisplayName} তাঁর নিকনেম রিসেট করেছেন`;
        
      await addDoc(collection(db, "messages"), {
        sender: "System",
        text: systemMessage,
        timestamp: serverTimestamp(),
        hasAttachment: false,
        seen: true,
        isSystem: true
      });

      setIsNicknameSaved(true);
      setTimeout(() => setIsNicknameSaved(false), 2000);
    } catch (e) {
      console.error("Error saving nickname:", e);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Partner status tracking
  const [partnerStatus, setPartnerStatus] = useState<UserStatus | null>(null);

  // Real-time notification and typing state
  const [activeNotification, setActiveNotification] = useState<{ sender: ChatUser; text: string } | null>(null);
  const isCurrentlyTypingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);
  const lastMessagesCountRef = useRef<number | null>(null);

  // Browser notification permissions
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return window.Notification.permission;
    }
    return "default";
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await window.Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === "granted") {
          if (notificationSound === "postal") {
            playPostalChime();
          } else {
            playSmsSound();
          }
          new window.Notification("ডাকঘর (Dakghor)", {
            body: "ব্রাউজার নোটিফিকেশন সফলভাবে চালু করা হয়েছে!",
            icon: "/favicon.ico",
          });
        }
      } catch (err) {
        console.error("Error requesting notification permission:", err);
      }
    }
  };

  // Gently auto-request browser notification permission on mount if default
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
      // Delay slightly so the UI is fully loaded first
      const timer = setTimeout(() => {
        window.Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        }).catch((err) => console.log("Gently requesting notification permission rejected/ignored:", err));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partnerUser: ChatUser = currentUser === "Saluk" ? "Digonto" : "Saluk";
  const currentUserDisplayName = sharedConfig.nicknames?.[currentUser] || currentUser;
  const partnerUserDisplayName = sharedConfig.nicknames?.[partnerUser] || partnerUser;

  const startRecording = async () => {
    try {
      isCancelledRef.current = false;
      audioChunksRef.current = [];
      setRecordingDuration(0);

      // Check browser support for mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("আপনার ব্রাউজারে অডিও রেকর্ডিং সাপোর্ট করে না (Audio recording not supported on your browser).");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      }

      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await sendVoiceMessage(base64Audio, recordingDuration);
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone recording access failed:", err);
      alert("মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি (Microphone access was denied or is not available).");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    
    isCancelledRef.current = true;
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    
    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const sendVoiceMessage = async (base64Audio: string, duration: number) => {
    try {
      const encryptedAudio = encryptText(base64Audio);
      const encryptedText = encryptText("[ভয়েস বার্তা (Voice Message)]");

      await addDoc(collection(db, "messages"), {
        sender: currentUser,
        text: encryptedText,
        audioUrl: encryptedAudio,
        audioDuration: duration,
        timestamp: serverTimestamp(),
        hasAttachment: true,
        seen: false
      });
    } catch (error) {
      console.error("Error sending voice message:", error);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const updateTypingStatus = async (isTyping: boolean) => {
    try {
      const userStatusRef = doc(db, "user_status", currentUser);
      await updateDoc(userStatusRef, {
        isTyping,
        lastActive: serverTimestamp()
      });
    } catch (e) {
      const userStatusRef = doc(db, "user_status", currentUser);
      await setDoc(userStatusRef, {
        uid: currentUser,
        status: "online",
        lastActive: serverTimestamp(),
        isTyping
      }, { merge: true });
    }
  };

  const handleTyping = () => {
    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isCurrentlyTypingRef.current = false;
      updateTypingStatus(false);
    }, 2000);
  };

  // Manage current user's online status in Firestore
  useEffect(() => {
    const userStatusRef = doc(db, "user_status", currentUser);
    
    // Set to online
    setDoc(userStatusRef, {
      uid: currentUser,
      status: "online",
      lastActive: serverTimestamp(),
      isTyping: false
    }, { merge: true });

    // Send a heartbeat every 15 seconds to ensure we stay fresh
    const heartbeat = setInterval(() => {
      setDoc(userStatusRef, {
        status: "online",
        lastActive: serverTimestamp()
      }, { merge: true });
    }, 15000);

    // Set offline on unmount (page refresh, tab close, etc.)
    const handleBeforeUnload = () => {
      setDoc(userStatusRef, {
        status: "offline",
        isTyping: false,
        lastActive: serverTimestamp()
      }, { merge: true });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      // Attempt to set offline immediately
      setDoc(userStatusRef, {
        status: "offline",
        isTyping: false,
        lastActive: serverTimestamp()
      }, { merge: true });
    };
  }, [currentUser]);

  // Subscribe to partner's status
  useEffect(() => {
    const partnerStatusRef = doc(db, "user_status", partnerUser);
    const unsubscribePartner = onSnapshot(partnerStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPartnerStatus({
          uid: partnerUser,
          status: data.status || "offline",
          lastActive: data.lastActive || null,
          isTyping: !!data.isTyping
        });
      }
    });
    return () => unsubscribePartner();
  }, [partnerUser]);

  // Real-time Firestore subscription & seen updates
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    
    // Safety timeout to guarantee the loading indicator closes in maximum 3 seconds
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        clearTimeout(safetyTimer);
        const list: { raw: FirestoreMessage; decrypted: DecryptedMessage }[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<FirestoreMessage, "id">;
          const id = docSnap.id;
          const raw: FirestoreMessage = { id, ...data };

          // Decrypt fields safely
          const decryptedText = raw.isSystem ? raw.text : decryptText(raw.text);
          const decryptedImageUrl = (raw.imageUrl && !raw.isSystem) ? decryptText(raw.imageUrl) : null;
          const decryptedFileName = (raw.fileName && !raw.isSystem) ? decryptText(raw.fileName) : null;
          const decryptedAudioUrl = (raw.audioUrl && !raw.isSystem) ? decryptText(raw.audioUrl) : null;

          // Convert firestore timestamp
          let msgDate: Date | null = null;
          if (raw.timestamp) {
            msgDate = raw.timestamp.toDate();
          }

          const decrypted: DecryptedMessage = {
            id,
            sender: raw.sender,
            text: decryptedText,
            imageUrl: decryptedImageUrl,
            fileName: decryptedFileName,
            audioUrl: decryptedAudioUrl,
            audioDuration: raw.audioDuration || null,
            timestamp: msgDate,
            seen: !!raw.seen,
            reactions: raw.reactions || {},
            isSystem: !!raw.isSystem,
          };

          list.push({ raw, decrypted });

          // If this message is sent by the other user and is currently unseen, mark it as seen!
          if (raw.sender !== currentUser && !raw.seen && raw.sender !== "System") {
            const docRef = doc(db, "messages", id);
            updateDoc(docRef, { seen: true }).catch((err) => {
              console.error("Error setting seen attribute:", err);
            });
          }
        });

        setMessages(list);
        setIsLoading(false);

        // Detect new incoming message from partner
        const newCount = list.length;
        if (lastMessagesCountRef.current !== null && newCount > lastMessagesCountRef.current) {
          const lastMsg = list[list.length - 1]?.decrypted;
          if (lastMsg && lastMsg.sender !== currentUser && lastMsg.sender !== "System" && !lastMsg.isSystem) {
            const msgTime = lastMsg.timestamp?.getTime() || Date.now();
            if (Date.now() - msgTime < 10000) {
              if (notificationSound === "postal") {
                playPostalChime();
              } else {
                playSmsSound();
              }
              
              const isVoice = !!lastMsg.audioUrl;
              
              // Set the active top sliding airmail notification banner
              const notificationText = isVoice
                ? "একটি ভয়েস মেসেজ পাঠিয়েছেন (Sent a voice message)"
                : lastMsg.text || "ছবি সংযুক্ত করা হয়েছে (Image attached)";

              setActiveNotification({
                sender: lastMsg.sender,
                text: notificationText
              });

              // Trigger Native Browser Notification when tab is inactive
              const isTabInactive = typeof document !== "undefined" && (document.hidden || !document.hasFocus());
              if (isTabInactive && typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
                const partnerName = sharedConfig.nicknames?.[lastMsg.sender] || lastMsg.sender;
                const notificationTitle = `${partnerName} থেকে নতুন চিঠি`;
                const notificationBody = isVoice 
                  ? "একটি ভয়েস মেসেজ পাঠিয়েছেন" 
                  : (lastMsg.text && lastMsg.text !== "[ভয়েস বার্তা (Voice Message)]" ? lastMsg.text : "ছবি সংযুক্ত করা হয়েছে");
                  
                try {
                  const notification = new window.Notification(notificationTitle, {
                    body: notificationBody,
                    icon: "/favicon.ico",
                  });
                  notification.onclick = () => {
                    window.focus();
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  };
                } catch (err) {
                  console.error("Error showing browser notification:", err);
                }
              }
              
              // Clear notification after 4.5 seconds
              setTimeout(() => {
                setActiveNotification((prev) => {
                  if (prev && prev.sender === lastMsg.sender && prev.text === notificationText) {
                    return null;
                  }
                  return prev;
                });
              }, 4500);
            }
          }
        }
        lastMessagesCountRef.current = newCount;
      },
      (error) => {
        console.error("Firestore messages subscription error:", error);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [currentUser]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle saving ImgBB API Key
  const handleImgbbKeyChange = (key: string) => {
    setImgbbKey(key);
    localStorage.setItem("imgbb_api_key", key);
  };

  // Image upload via ImgBB
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!imgbbKey) {
      alert("Please configure your ImgBB API Key first in Settings!");
      setShowImgbbSettings(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append("image", file);

      setUploadProgress(50);
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);
      const result = await response.json();

      if (result.success && result.data && result.data.url) {
        setUploadProgress(100);
        // Direct encryption
        const encryptedText = encryptText(`[ছবি সংযুক্ত / Image Shared]`);
        const encryptedImageUrl = encryptText(result.data.url);
        const encryptedFileName = encryptText(file.name);

        await addDoc(collection(db, "messages"), {
          sender: currentUser,
          text: encryptedText,
          imageUrl: encryptedImageUrl,
          fileName: encryptedFileName,
          timestamp: serverTimestamp(),
          hasAttachment: true,
          seen: false,
        });
      } else {
        alert(`ImgBB upload failed: ${result.error?.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("ImgBB upload error:", error);
      alert("Error uploading. Check key and connection.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Sending plaintext message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const messageText = text.trim();
    setText("");

    // Clear typing timeout and reset status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isCurrentlyTypingRef.current = false;
    updateTypingStatus(false);

    try {
      const encryptedText = encryptText(messageText);

      await addDoc(collection(db, "messages"), {
        sender: currentUser,
        text: encryptedText,
        timestamp: serverTimestamp(),
        hasAttachment: false,
        seen: false,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to deliver securely.");
    }
  };

  // Safe manual logout updating status
  const handleSecureLogout = async () => {
    try {
      const userStatusRef = doc(db, "user_status", currentUser);
      await setDoc(userStatusRef, {
        status: "offline",
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
    onLogout();
  };

  // Calculate elegant partner status text
  const getPartnerStatusDisplay = () => {
    if (!partnerStatus) return "অফলাইন (Offline)";
    
    if (partnerStatus.status === "online") {
      // Double check heartbeat
      if (partnerStatus.lastActive) {
        const lastActiveDate = partnerStatus.lastActive.toDate();
        const diffMs = Date.now() - lastActiveDate.getTime();
        // If active in last 60 seconds
        if (diffMs < 60000) {
          return "অনলাইন (Active now)";
        }
      } else {
        return "অনলাইন (Active now)";
      }
    }

    if (!partnerStatus.lastActive) return "অফলাইন (Offline)";

    const lastActiveDate = partnerStatus.lastActive.toDate();
    const diffMs = Date.now() - lastActiveDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return "এইমাত্র অনলাইন ছিলেন (Active just now)";
    } else if (diffMins < 60) {
      return `${diffMins} মিনিট আগে অনলাইন ছিলেন (${diffMins} min ago online)`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours} ঘণ্টা আগে অনলাইন ছিলেন (${diffHours}h ago online)`;
      } else {
        return lastActiveDate.toLocaleDateString() + " এ অনলাইন ছিলেন";
      }
    }
  };

  const isPartnerOnline = () => {
    if (!partnerStatus) return false;
    if (partnerStatus.status === "online") {
      if (partnerStatus.lastActive) {
        const lastActiveDate = partnerStatus.lastActive.toDate();
        return Date.now() - lastActiveDate.getTime() < 60000;
      }
      return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col h-screen bg-amber-950/20 text-slate-900 font-sans relative overflow-hidden">
      
      {/* Antique leather desk wooden panel top border */}
      <div className="absolute top-0 left-0 right-0 h-1.5 airmail-stripes z-50"></div>

      {/* Main Header styled like top of a premium retro parchment envelope */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 sm:py-2.5 bg-parchment-light border-b border-parchment-border/80 sticky top-1 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            {/* Postal Stamp Styled avatar */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-parchment-dark border-2 border-dashed border-parchment-border flex items-center justify-center shadow-inner relative group">
              <span className="font-serif font-bold text-sm sm:text-base text-postal-red">
                {currentUser[0]}
              </span>
              {/* Circular mini postmark ink */}
              <div className="absolute inset-0.5 rounded border border-postal-blue/10 pointer-events-none flex items-center justify-center">
                <span className="text-[5px] font-mono font-bold text-postal-blue/20 rotate-12">POSTAL</span>
              </div>
            </div>
            {/* Status indicator badge */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-600 border border-parchment-light rounded-full flex items-center justify-center shadow">
              <span className="w-1 h-1 bg-white rounded-full animate-ping" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-slate-900 text-xs sm:text-sm">
                {currentUserDisplayName}
              </span>
              <span className="text-[9px] bg-parchment-dark px-1.5 py-0.2 rounded border border-parchment-border/60 font-mono text-slate-500">
                {currentUser}
              </span>
            </div>

            {/* Live status bar for the partner */}
            <div className="flex items-center gap-1 mt-0.5 font-sans text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline() ? "bg-emerald-500 animate-pulse" : "bg-amber-600"}`} />
              <p className="text-slate-500 font-mono text-[10px] font-medium">
                {partnerUserDisplayName}: <span className={isPartnerOnline() ? "text-emerald-700 font-semibold" : "text-amber-800"}>{getPartnerStatusDisplay()}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {/* E2EE Security visualizer badge */}
          <SecurityBadge currentUser={currentUser} />

          {/* Configuration drawer triggers */}
          <button
            onClick={() => setShowImgbbSettings(!showImgbbSettings)}
            className={`p-1.5 sm:p-2 rounded-lg transition-all border font-mono text-[11px] flex items-center gap-1.5 cursor-pointer ${
              showImgbbSettings
                ? "bg-postal-red text-white border-postal-darkred"
                : "bg-parchment-dark border-parchment-border text-slate-700 hover:bg-parchment-border/40"
            }`}
            title="ছবি সংযুক্তি"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">ছবি সংযুক্তি</span>
            {imgbbKey ? (
              <span className="w-1 h-1 bg-emerald-500 rounded-full" />
            ) : (
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Secure disconnect */}
          <button
            onClick={handleSecureLogout}
            className="p-1.5 sm:p-2 rounded-lg bg-postal-red border border-postal-darkred text-white hover:bg-postal-darkred transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 font-mono text-[11px] shadow-sm shrink-0 font-bold"
            title="সাইন আউট"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>সাইন আউট</span>
          </button>
        </div>
      </header>

      {/* Main layout container with classic handwriting desk view */}
      <div className={`flex flex-1 relative overflow-hidden texture-${paperTexture}`}>
        
        {/* Messages feed area inside a beautifully bound post diary container */}
        <main className="flex-1 flex flex-col justify-between overflow-hidden relative">
          
          {/* Top Sliding Airmail Notification Toast */}
          <AnimatePresence>
            {activeNotification && (
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", damping: 20, stiffness: 150 }}
                className="absolute top-4 left-4 right-4 md:left-6 md:right-6 z-40"
              >
                {/* Vintage Airmail styled notification box */}
                <div className="bg-[#fdfbf7] border-2 border-dashed border-postal-red/60 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 relative overflow-hidden">
                  
                  {/* Airmail stripe overlay border inside the box */}
                  <div className="absolute top-0 left-0 right-0 h-1 airmail-stripes opacity-80" />
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-postal-red/10 border border-postal-red/20 flex items-center justify-center text-postal-red shrink-0 animate-pulse">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-slate-900">
                        নতুন চিঠি এসেছে! ({sharedConfig.nicknames?.[activeNotification.sender] || activeNotification.sender} থেকে)
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 handwritten">
                        {activeNotification.text}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        setActiveNotification(null);
                      }}
                      className="px-3.5 py-1.5 bg-postal-red hover:bg-postal-darkred text-white text-xs font-serif font-semibold rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      পড়ুন
                    </button>
                    <button
                      onClick={() => setActiveNotification(null)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-postal-red" />
              <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                ডাকঘর সংযোগ করা হচ্ছে...
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
                  <div className="w-20 h-20 rounded-full bg-parchment-dark border border-parchment-border flex items-center justify-center text-postal-red shadow-inner relative">
                    <Mail className="w-8 h-8" />
                    {/* Retro ink stamp layout overlay */}
                    <div className="absolute -inset-1.5 rounded-full border border-postal-red/10 rotate-12 pointer-events-none" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-slate-800 text-lg">
                      কোনো চিঠি আদান-প্রদান হয়নি
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed handwritten">
                      {partnerUserDisplayName} এর সাথে যোগাযোগের জন্য একটি সুরক্ষিত চিঠি পাঠান। আপনার পাঠানো সকল চিঠি শক্তিশালী AES-256 এনক্রিপশন দ্বারা প্যাক করা থাকবে।
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageItem
                    key={msg.decrypted.id}
                    message={msg.decrypted}
                    rawFirestoreMessage={msg.raw}
                    isSelf={msg.raw.sender === currentUser}
                    currentUser={currentUser}
                    onImageClick={(url) => setSelectedImage(url)}
                    senderDisplayName={
                      msg.raw.sender === currentUser
                        ? currentUserDisplayName
                        : partnerUserDisplayName
                    }
                  />
                ))
              )}

              {/* Retro typing status indicator bubble */}
              <AnimatePresence>
                {partnerStatus?.isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="flex justify-start mb-4"
                  >
                    <div className="bg-white/80 backdrop-blur-sm border border-parchment-border/70 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 font-serif text-[13px] text-slate-700 italic select-none">
                      <div className="w-6 h-6 rounded-lg bg-parchment-dark border border-parchment-border flex items-center justify-center text-[10px] font-mono font-bold text-postal-red shrink-0">
                        {partnerUser[0]}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>{partnerUserDisplayName} চিঠি লিখছেন</span>
                        <span className="flex gap-1 items-center h-2">
                          <span className="w-1.5 h-1.5 bg-postal-red/85 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.9s' }} />
                          <span className="w-1.5 h-1.5 bg-postal-red/85 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.9s' }} />
                          <span className="w-1.5 h-1.5 bg-postal-red/85 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.9s' }} />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Typing/Uploading inline feedback */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-6 py-2.5 bg-parchment-dark border-t border-parchment-border/70 flex items-center justify-between text-xs text-slate-600 font-mono"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-postal-red" />
                  <span>ছবিটি সুরক্ষিতভাবে পাঠানো হচ্ছে... ({uploadProgress}%)</span>
                </div>
                <div className="w-24 bg-white border border-parchment-border h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-postal-red h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ImgBB Missing Banner warnings */}
          {!imgbbKey && !showImgbbSettings && (
            <div className="mx-4 sm:mx-6 mb-3 bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-sm animate-pulse">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ImgBB API Key সেট করা নেই। ছবি সংযুক্ত করতে সেটিংস এ গিয়ে API Key প্রদান করুন।</span>
              </span>
              <button
                onClick={() => setShowImgbbSettings(true)}
                className="font-bold underline uppercase tracking-wider text-[10px] font-mono text-postal-red hover:text-postal-darkred cursor-pointer ml-3 shrink-0"
              >
                সেট কী (Set Key)
              </button>
            </div>
          )}

          {/* Retro Typewriter styled input block */}
          <div className="px-4 sm:px-6 py-4 bg-parchment-light border-t border-parchment-border/80 sticky bottom-0 z-10 shadow-inner">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3">
              {/* Secret upload field */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
                disabled={isUploading || isRecording}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isRecording}
                className={`p-3.5 rounded-2xl bg-parchment-dark border border-parchment-border text-slate-700 hover:bg-parchment-border/50 hover:text-postal-red transition-all cursor-pointer shrink-0 relative ${
                  isUploading || isRecording ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Attach Encrypted Image/Stamp"
              >
                <ImageIcon className="w-5 h-5" />
                {imgbbKey && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-parchment-dark rounded-full" />
                )}
              </button>

              {/* Dynamic Vintage Microphone Recorder Trigger */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploading}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer shrink-0 relative flex items-center justify-center ${
                  isRecording
                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse scale-105"
                    : "bg-parchment-dark border-parchment-border text-slate-700 hover:bg-parchment-border/50 hover:text-postal-red"
                }`}
                title={isRecording ? "Stop and Send Voice Message" : "Record Secure Voice Clip"}
              >
                <Mic className={`w-5 h-5 ${isRecording ? "text-white" : ""}`} />
              </button>

              {/* Dynamic input vs recording status overlay */}
              {isRecording ? (
                <div className="flex-1 bg-[#fdf2f2] border border-postal-red/30 rounded-2xl py-3 px-4 flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-2.5 w-2.5 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-postal-red opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-postal-red"></span>
                    </span>
                    <span className="font-mono text-xs font-bold text-postal-red shrink-0 tracking-wider">
                      রেকর্ড হচ্ছে (Recording)... {formatDuration(recordingDuration)}
                    </span>
                    {/* Retro-styled bouncing waveform lines */}
                    <div className="flex items-end gap-0.5 h-3.5 px-1 shrink-0">
                      <span className="w-0.5 bg-postal-red rounded-full animate-bounce h-2" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                      <span className="w-0.5 bg-postal-red rounded-full animate-bounce h-3.5" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
                      <span className="w-0.5 bg-postal-red rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
                      <span className="w-0.5 bg-postal-red rounded-full animate-bounce h-3" style={{ animationDelay: '450ms', animationDuration: '0.6s' }} />
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="text-[11px] font-serif font-bold text-slate-500 hover:text-slate-800 bg-white border border-parchment-border hover:bg-slate-50 px-3 py-1.5 rounded-xl shadow-sm cursor-pointer transition-colors"
                  >
                    বাতিল
                  </button>
                </div>
              ) : (
                <>
                  {/* Message text field with classic paper look */}
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      handleTyping();
                    }}
                    placeholder="মেসেজ পাঠান..."
                    disabled={isUploading}
                    className="flex-1 bg-white border border-parchment-border focus:border-postal-red rounded-2xl py-3.5 px-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-postal-red/10 transition-all font-sans text-sm tracking-wide shadow-sm"
                  />

                  {/* Elegant paper plane dispatch */}
                  <button
                    type="submit"
                    disabled={isUploading || !text.trim()}
                    className={`p-3.5 rounded-2xl shadow-md flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      !text.trim() || isUploading
                        ? "bg-parchment-dark text-slate-300 border border-parchment-border/40 cursor-not-allowed"
                        : "bg-postal-red hover:bg-postal-darkred text-white hover:scale-105 active:scale-95"
                    }`}
                    title="চিঠি পাঠান"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </>
              )}
            </form>
          </div>
        </main>

        {/* Settings panel wrapper */}
        <AnimatePresence>
          {showImgbbSettings && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowImgbbSettings(false)}
                className="absolute inset-0 bg-amber-950/40 z-40 cursor-pointer"
              />

              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 210 }}
                className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-parchment-light border-l border-parchment-border z-50 p-6 shadow-2xl flex flex-col justify-between"
              >
                <div className="space-y-6 overflow-y-auto pr-1 flex-1">
                  <div className="flex items-center justify-between pb-4 border-b border-parchment-border/80">
                    <div className="flex items-center gap-2">
                      <Inbox className="w-5 h-5 text-postal-red" />
                      <h3 className="font-serif font-bold text-slate-800 text-base">ডাকঘর সেটিংস</h3>
                    </div>
                    <button
                      onClick={() => setShowImgbbSettings(false)}
                      className="p-1.5 rounded-lg bg-parchment-dark border border-parchment-border text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nickname Selection */}
                  <div className="bg-white border border-parchment-border/80 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <User className="w-4.5 h-4.5 text-postal-red" />
                      <div>
                        <h4 className="font-serif font-bold text-xs text-slate-800 uppercase tracking-wider">নিকনেম সেট করুন</h4>
                        <p className="text-[10px] text-slate-400">ডাকঘরে আপনার ছদ্মনামটি লিখুন</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        placeholder="আপনার নতুন নিকনেম..."
                        maxLength={15}
                        className="w-full bg-slate-50 border border-parchment-border/40 focus:border-postal-red rounded-xl py-2 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-postal-red/25 text-xs transition-all"
                      />
                      <button
                        onClick={saveNickname}
                        className={`w-full py-2 px-4 rounded-xl font-medium text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          isNicknameSaved
                            ? "bg-emerald-600 text-white"
                            : "bg-postal-red hover:bg-postal-darkred text-white"
                        }`}
                      >
                        {isNicknameSaved ? (
                          <span>নিকনেম সংরক্ষিত হয়েছে!</span>
                        ) : (
                          <span>নিকনেম সেভ করুন</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Paper Texture Selection */}
                  <div className="bg-white border border-parchment-border/80 rounded-2xl p-4 shadow-sm space-y-3.5">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <Palette className="w-4.5 h-4.5 text-postal-red" />
                      <div>
                        <h4 className="font-serif font-bold text-xs text-slate-800 uppercase tracking-wider">কাগজের ধরন</h4>
                        <p className="text-[10px] text-slate-400">উভয় ব্যবহারকারীর চ্যাট ব্যাকগ্রাউন্ড থিম</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Aged Parchment Option */}
                      <button
                        onClick={() => updateSharedTexture("parchment")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "parchment"
                            ? "border-postal-red bg-[#fdfbf7] shadow-sm ring-1 ring-postal-red/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-parchment-border texture-parchment shrink-0 flex items-center justify-center text-[13px] font-bold">
                          📜
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">প্রাচীন পার্চমেন্ট</div>
                          <div className="text-[9px] text-slate-400 truncate">ক্লাসিক অ্যান্টিক পার্চমেন্ট থিম</div>
                        </div>
                        {paperTexture === "parchment" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Blue Airmail Option */}
                      <button
                        onClick={() => updateSharedTexture("airmail")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "airmail"
                            ? "border-postal-red bg-[#f0f4f8] shadow-sm ring-1 ring-postal-red/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-blue-200 texture-airmail shrink-0 flex items-center justify-center text-[13px] font-bold">
                          ✈️
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">বিমান ডাক খাম</div>
                          <div className="text-[9px] text-slate-400 truncate">হালকা নীল রেট্রো বিমান ডাক থিম</div>
                        </div>
                        {paperTexture === "airmail" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Telegram Paper Option */}
                      <button
                        onClick={() => updateSharedTexture("telegram")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "telegram"
                            ? "border-postal-red bg-[#faf4e8] shadow-sm ring-1 ring-postal-red/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-amber-200 texture-telegram shrink-0 flex items-center justify-center text-[13px] font-bold">
                          ⚡
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">টেলিগ্রাম কাগজ</div>
                          <div className="text-[9px] text-slate-400 truncate">হলদেটে টেলিগ্রাফ নিউজপ্রিন্ট থিম</div>
                        </div>
                        {paperTexture === "telegram" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Royal Velvet Option */}
                      <button
                        onClick={() => updateSharedTexture("velvet")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "velvet"
                            ? "border-rose-400 bg-rose-950/20 shadow-sm ring-1 ring-rose-400/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-rose-300 texture-velvet shrink-0 flex items-center justify-center text-[13px] font-bold">
                          👑
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">রাজকীয় মখমল</div>
                          <div className="text-[9px] text-slate-400 truncate">অভিজাত গাঢ় লাল ভেলভেট থিম</div>
                        </div>
                        {paperTexture === "velvet" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Forest Moss Option */}
                      <button
                        onClick={() => updateSharedTexture("forest")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "forest"
                            ? "border-emerald-400 bg-emerald-950/20 shadow-sm ring-1 ring-emerald-400/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-emerald-300 texture-forest shrink-0 flex items-center justify-center text-[13px] font-bold">
                          🌿
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">বনলতা সবুজ</div>
                          <div className="text-[9px] text-slate-400 truncate">প্রাকৃতিক শান্ত সবুজ বনের আবহ</div>
                        </div>
                        {paperTexture === "forest" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Midnight Celestial Option */}
                      <button
                        onClick={() => updateSharedTexture("midnight")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "midnight"
                            ? "border-indigo-400 bg-indigo-950/20 shadow-sm ring-1 ring-indigo-400/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-indigo-300 texture-midnight shrink-0 flex items-center justify-center text-[13px] font-bold">
                          🌌
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">রাতের আকাশ</div>
                          <div className="text-[9px] text-slate-400 truncate">নক্ষত্রখচিত গাঢ় নীল মহাজাগতিক থিম</div>
                        </div>
                        {paperTexture === "midnight" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Vintage Rose Option */}
                      <button
                        onClick={() => updateSharedTexture("rose")}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paperTexture === "rose"
                            ? "border-pink-300 bg-pink-50 shadow-sm ring-1 ring-pink-300/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-pink-200 texture-rose shrink-0 flex items-center justify-center text-[13px] font-bold">
                          🌸
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">গোলাপী চিঠি</div>
                          <div className="text-[9px] text-slate-400 truncate">মিষ্টি গোলাপি রঙের রোমান্টিক থিম</div>
                        </div>
                        {paperTexture === "rose" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Notification Sound Selection */}
                  <div className="bg-white border border-parchment-border/80 rounded-2xl p-4 shadow-sm space-y-3.5">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <Volume2 className="w-4.5 h-4.5 text-postal-red" />
                      <div>
                        <h4 className="font-serif font-bold text-xs text-slate-800 uppercase tracking-wider">বিজ্ঞপ্তির শব্দ (Notification Sound)</h4>
                        <p className="text-[10px] text-slate-400">নতুন মেসেজ আসলে যে শব্দ বাজবে</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Modern SMS Sound */}
                      <button
                        onClick={() => {
                          setNotificationSound("sms");
                          localStorage.setItem("notification_sound", "sms");
                          playSmsSound();
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          notificationSound === "sms"
                            ? "border-postal-red bg-[#fdfbf7] shadow-sm ring-1 ring-postal-red/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-parchment-border bg-slate-100 shrink-0 flex items-center justify-center text-[13px] font-bold">
                          📱
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">ডিজিটাল এসএমএস (Modern SMS)</div>
                          <div className="text-[9px] text-slate-400 truncate">নতুন দ্বৈত বীপ সংকেত (ডাবল-বীপ)</div>
                        </div>
                        {notificationSound === "sms" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>

                      {/* Vintage Postal Chime */}
                      <button
                        onClick={() => {
                          setNotificationSound("postal");
                          localStorage.setItem("notification_sound", "postal");
                          playPostalChime();
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          notificationSound === "postal"
                            ? "border-postal-red bg-[#fdfbf7] shadow-sm ring-1 ring-postal-red/20"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-parchment-border bg-slate-100 shrink-0 flex items-center justify-center text-[13px] font-bold">
                          🔔
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-xs text-slate-800">ভিন্টেজ বেল (Classic Chime)</div>
                          <div className="text-[9px] text-slate-400 truncate">ঐতিহ্যবাহী ডাকঘর মেটাল বেল টোন</div>
                        </div>
                        {notificationSound === "postal" && (
                          <div className="w-4 h-4 rounded-full bg-postal-red flex items-center justify-center text-white text-[9px] font-bold shrink-0">✓</div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Browser Notification Status Card */}
                  <div className="bg-white border border-parchment-border/80 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <Bell className="w-4.5 h-4.5 text-postal-red" />
                      <div>
                        <h4 className="font-serif font-bold text-xs text-slate-800 uppercase tracking-wider">ব্রাউজার নোটিফিকেশন</h4>
                        <p className="text-[10px] text-slate-400">মেসেজ আসলে পুশ নোটিফিকেশন পাবেন</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2">
                        <span>স্থিতি (Status):</span>
                        <span className={`font-semibold ${
                          notificationPermission === "granted"
                            ? "text-emerald-600"
                            : notificationPermission === "denied"
                            ? "text-postal-red"
                            : "text-amber-600"
                        }`}>
                          {notificationPermission === "granted" && "অনুমতি দেওয়া আছে (Allowed)"}
                          {notificationPermission === "denied" && "ব্লক করা (Blocked)"}
                          {notificationPermission === "default" && "অনুমতি চাওয়া হয়নি (Not Requested)"}
                        </span>
                      </div>

                      {notificationPermission !== "granted" && (
                        <button
                          onClick={requestNotificationPermission}
                          className="w-full py-2 px-4 rounded-xl font-medium text-[11px] flex items-center justify-center gap-1.5 cursor-pointer bg-postal-blue hover:bg-postal-darkblue text-white transition-all shadow-xs"
                        >
                          <Bell className="w-3.5 h-3.5 animate-bounce" />
                          <span>নোটিফিকেশন সক্রিয় করুন</span>
                        </button>
                      )}

                      {notificationPermission === "granted" && (
                        <button
                          onClick={() => {
                            if (notificationSound === "postal") {
                              playPostalChime();
                            } else {
                              playSmsSound();
                            }
                            if (typeof window !== "undefined" && "Notification" in window) {
                              new window.Notification("ডাকঘর (Dakghor)", {
                                body: "পরীক্ষামূলক নোটিফিকেশন! আপনার ডাকঘর সচল রয়েছে।",
                                icon: "/favicon.ico"
                              });
                            }
                          }}
                          className="w-full py-2 px-4 rounded-xl font-medium text-[11px] flex items-center justify-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200"
                        >
                          <span>টেস্ট নোটিফিকেশন ও সাউন্ড পাঠান</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <ImgBBSettings onKeyChange={handleImgbbKeyChange} currentKey={imgbbKey} />
                </div>

                <div className="border-t border-parchment-border/80 pt-4 text-[10px] font-mono text-slate-500 space-y-1.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-postal-blue" />
                    <span>সংযোগ স্থিতি: নিরাপদ ডাকঘর সংযোগ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>সুরক্ষিত তথ্যভাণ্ডার: অনলাইন</span>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Retro aesthetic lightbox for shared pictures */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          >
            <div className="absolute inset-0 z-40" onClick={() => setSelectedImage(null)} />

            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-parchment-light border border-parchment-border text-slate-700 hover:text-postal-red cursor-pointer shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>

            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-50 max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden border-4 border-parchment-light shadow-2xl bg-parchment-light"
            >
              <img
                src={selectedImage}
                alt="Shared Postal Picture"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </motion.div>

            <div className="relative z-50 mt-4 text-center font-serif text-xs text-slate-200 flex items-center gap-1.5 bg-postal-blue/40 px-4 py-2 rounded-xl border border-white/10 shadow-lg">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>সুরক্ষিত ডাকঘর গ্যালারি - AES-256 Decrypted View</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
