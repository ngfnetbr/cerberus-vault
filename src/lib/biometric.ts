// Legacy biometric recovery for users migrating from the original beta.
// New enrollment remains disabled because the legacy format stores its XOR
// key beside the obfuscated password. Existing data may be used once to unlock
// and replace the master password, at which point it is removed.

const BIOMETRIC_ENABLED_KEY = 'vault_biometric_enabled';
const BIOMETRIC_CREDENTIAL_KEY = 'vault_biometric_cred';
const BIOMETRIC_ENCRYPTED_PW_KEY = 'vault_biometric_pw';

export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_ENCRYPTED_PW_KEY);
}

export function isBiometricSupported(): boolean {
  return Boolean(window.PublicKeyCredential) && isBiometricEnabled();
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
    && Boolean(localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY))
    && Boolean(localStorage.getItem(BIOMETRIC_ENCRYPTED_PW_KEY));
}

export function updateBiometricPassword(_masterPassword: string): void {
  disableBiometric();
}

export async function registerBiometric(_masterPassword: string): Promise<boolean> {
  // Unsafe legacy enrollment must not be used for new vaults.
  return false;
}

export async function authenticateWithBiometric(): Promise<string | null> {
  if (!isBiometricEnabled()) return null;

  try {
    const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)!;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: Uint8Array.from(atob(credentialId), character => character.charCodeAt(0)).buffer,
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (!assertion) return null;

    const [dataValue, keyValue] = localStorage.getItem(BIOMETRIC_ENCRYPTED_PW_KEY)!.split('|');
    if (!dataValue || !keyValue) return null;
    const data = Uint8Array.from(atob(dataValue), character => character.charCodeAt(0));
    const key = Uint8Array.from(atob(keyValue), character => character.charCodeAt(0));
    const plaintext = new Uint8Array(data.length);
    for (let index = 0; index < data.length; index++) plaintext[index] = data[index] ^ key[index % key.length];
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
      console.error('Legacy biometric recovery failed:', error);
    }
    return null;
  }
}
