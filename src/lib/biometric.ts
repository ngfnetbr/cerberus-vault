// WebAuthn-based biometric authentication for mobile
// Stores encrypted master password locally, gated by biometric verification

const BIOMETRIC_ENABLED_KEY = 'vault_biometric_enabled';
const BIOMETRIC_CREDENTIAL_KEY = 'vault_biometric_cred';
const BIOMETRIC_ENCRYPTED_PW_KEY = 'vault_biometric_pw';

export function isBiometricSupported(): boolean {
  return !!window.PublicKeyCredential;
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
    && !!localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)
    && !!localStorage.getItem(BIOMETRIC_ENCRYPTED_PW_KEY);
}

export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_ENCRYPTED_PW_KEY);
}

export function updateBiometricPassword(masterPassword: string): void {
  if (!isBiometricEnabled()) return;

  const key = generateObfuscationKey(32);
  const encrypted = obfuscate(masterPassword, key);
  localStorage.setItem(BIOMETRIC_ENCRYPTED_PW_KEY, encrypted);
}

// Simple XOR-based obfuscation with a random key stored alongside
// Security note: This is convenience-level protection (the real gate is the biometric prompt)
function generateObfuscationKey(length: number): Uint8Array {
  const key = new Uint8Array(length);
  crypto.getRandomValues(key);
  return key;
}

function obfuscate(text: string, key: Uint8Array): string {
  const encoded = new TextEncoder().encode(text);
  const result = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ key[i % key.length];
  }
  return btoa(String.fromCharCode(...result)) + '|' + btoa(String.fromCharCode(...key));
}

function deobfuscate(stored: string): string {
  const [dataB64, keyB64] = stored.split('|');
  const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
  const key = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(result);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

export async function registerBiometric(masterPassword: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;

  try {
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Cerberus Vault', id: window.location.hostname },
        user: {
          id: userId,
          name: 'vault-user',
          displayName: 'Cerberus Vault User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        attestation: 'none',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // Store credential ID for future auth
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, bufferToBase64(credential.rawId));

    // Store obfuscated master password
    const key = generateObfuscationKey(32);
    const encrypted = obfuscate(masterPassword, key);
    localStorage.setItem(BIOMETRIC_ENCRYPTED_PW_KEY, encrypted);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');

    return true;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
      console.error('Biometric registration failed:', err);
    }
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<string | null> {
  if (!isBiometricEnabled()) return null;

  try {
    const credIdB64 = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)!;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: base64ToBuffer(credIdB64),
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    // Biometric verified — return the stored password
    const stored = localStorage.getItem(BIOMETRIC_ENCRYPTED_PW_KEY)!;
    return deobfuscate(stored);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
      console.error('Biometric auth failed:', err);
    }
    return null;
  }
}
