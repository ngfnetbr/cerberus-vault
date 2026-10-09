// Biometric unlock is intentionally disabled in the beta release.
// The previous implementation stored an XOR-obfuscated master password next
// to its key, so localStorage access was enough to recover the password.

const BIOMETRIC_ENABLED_KEY = 'vault_biometric_enabled';
const BIOMETRIC_CREDENTIAL_KEY = 'vault_biometric_cred';
const BIOMETRIC_ENCRYPTED_PW_KEY = 'vault_biometric_pw';

export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_ENCRYPTED_PW_KEY);
}

export function isBiometricSupported(): boolean {
  disableBiometric();
  return false;
}

export function isBiometricEnabled(): boolean {
  disableBiometric();
  return false;
}

export function updateBiometricPassword(_masterPassword: string): void {
  disableBiometric();
}

export async function registerBiometric(_masterPassword: string): Promise<boolean> {
  disableBiometric();
  return false;
}

export async function authenticateWithBiometric(): Promise<string | null> {
  disableBiometric();
  return null;
}
