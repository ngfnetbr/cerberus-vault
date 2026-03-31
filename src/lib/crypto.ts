// PBKDF2 + AES-256-GCM encryption utilities using Web Crypto API

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
}

async function deriveKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(plaintext: string, masterPassword: string): Promise<string> {
  const keyMaterial = await getKeyMaterial(masterPassword);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(keyMaterial, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Format: base64(salt) + '.' + base64(iv) + '.' + base64(ciphertext)
  return `${arrayBufferToBase64(salt.buffer as ArrayBuffer)}.${arrayBufferToBase64(iv.buffer as ArrayBuffer)}.${arrayBufferToBase64(ciphertext)}`;
}

export async function decrypt(encryptedData: string, masterPassword: string): Promise<string> {
  const [saltB64, ivB64, ciphertextB64] = encryptedData.split('.');
  if (!saltB64 || !ivB64 || !ciphertextB64) throw new Error('Invalid encrypted data format');

  const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
  const ciphertext = base64ToArrayBuffer(ciphertextB64);

  const keyMaterial = await getKeyMaterial(masterPassword);
  const key = await deriveKey(keyMaterial, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Hash master password to verify login without storing the password
export async function hashMasterPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial, salt);

  // Encrypt a known string to use as verification
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const verificationData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode('VAULT_VERIFICATION_TOKEN')
  );

  return `${arrayBufferToBase64(salt.buffer as ArrayBuffer)}.${arrayBufferToBase64(iv.buffer as ArrayBuffer)}.${arrayBufferToBase64(verificationData)}`;
}

export async function verifyMasterPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [saltB64, ivB64, ciphertextB64] = hash.split('.');
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
    const ciphertext = base64ToArrayBuffer(ciphertextB64);

    const keyMaterial = await getKeyMaterial(password);
    const key = await deriveKey(keyMaterial, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted) === 'VAULT_VERIFICATION_TOKEN';
  } catch {
    return false;
  }
}
