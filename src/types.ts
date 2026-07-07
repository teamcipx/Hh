export type ChatUser = "Saluk" | "Digonto";

export interface FirestoreMessage {
  id: string;
  sender: ChatUser | "System";
  text: string; // AES Encrypted
  imageUrl?: string; // AES Encrypted
  fileName?: string; // AES Encrypted
  audioUrl?: string; // AES Encrypted Base64 audio clip
  audioDuration?: number; // duration in seconds
  timestamp: any; // Firestore Timestamp
  hasAttachment?: boolean;
  seen?: boolean;
  reactions?: { [username: string]: string };
  isSystem?: boolean;
}

export interface DecryptedMessage {
  id: string;
  sender: ChatUser | "System";
  text: string;
  imageUrl: string | null;
  fileName: string | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
  timestamp: Date | null;
  seen: boolean;
  reactions?: { [username: string]: string };
  isSystem?: boolean;
}

export interface UserStatus {
  uid: ChatUser;
  status: "online" | "offline";
  lastActive: any;
  isTyping?: boolean;
}
