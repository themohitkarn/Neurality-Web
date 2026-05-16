/**
 * ENCRYPTION MANAGER (E2EE)
 * 
 * Implements E2EE for signaling and secret chats using 
 * the Web Crypto API (AES-GCM + ECDH).
 */

export default class EncryptionManager {
  static async generateKeyPair() {
    return await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false, // non-extractable for security
      ["deriveKey"]
    );
  }

  static async deriveSharedSecret(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(data, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
    
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      iv: btoa(String.fromCharCode(...iv))
    };
  }

  static async decrypt(encryptedData, key) {
    const ciphertext = Uint8Array.from(atob(encryptedData.ciphertext), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}
