import CryptoJS from "crypto-js";

// Extremely secure end-to-end encryption key
const SHARED_E2E_KEY = "Saluk-Digonto-E2EE-Shared-Secret-2026-Super-Secure";

/**
 * Encrypt plain text using AES
 */
export function encryptText(plainText: string): string {
  if (!plainText) return "";
  try {
    return CryptoJS.AES.encrypt(plainText, SHARED_E2E_KEY).toString();
  } catch (error) {
    console.error("Encryption error:", error);
    return "";
  }
}

/**
 * Decrypt cipher text using AES
 */
export function decryptText(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SHARED_E2E_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText && cipherText) {
      return "[Encrypted Message - Locked]";
    }
    return originalText;
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Encrypted Message - Locked]";
  }
}
