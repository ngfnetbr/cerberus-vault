const SESSION_PASSWORD_KEY = 'cerberus_master_password';
const LOCK_ALARM = 'cerberus_auto_lock';
const LOCK_MINUTES = 5;
const VERIFICATION_TOKEN = 'VAULT_VERIFICATION_TOKEN';

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

async function decryptValue(encryptedValue, password) {
  const [saltValue, ivValue, ciphertextValue] = encryptedValue.split('.');
  if (!saltValue || !ivValue || !ciphertextValue) throw new Error('Formato criptografado inválido.');
  const salt = fromBase64(saltValue);
  const iv = fromBase64(ivValue);
  const ciphertext = fromBase64(ciphertextValue);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function verifyPassword(password, masterHash) {
  try { return (await decryptValue(masterHash, password)) === VERIFICATION_TOKEN; }
  catch { return false; }
}

function normalizeHostname(value) {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(candidate).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

async function getPassword() {
  const session = await chrome.storage.session.get(SESSION_PASSWORD_KEY);
  return session[SESSION_PASSWORD_KEY] || null;
}

async function keepUnlocked(password) {
  await chrome.storage.session.set({ [SESSION_PASSWORD_KEY]: password });
  await chrome.alarms.clear(LOCK_ALARM);
  await chrome.alarms.create(LOCK_ALARM, { delayInMinutes: LOCK_MINUTES });
}

async function lock() {
  await chrome.storage.session.remove(SESSION_PASSWORD_KEY);
  await chrome.alarms.clear(LOCK_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === LOCK_ALARM) lock(); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'STATUS') {
      const vault = await chrome.storage.local.get('vault');
      sendResponse({ imported: Boolean(vault.vault), unlocked: Boolean(await getPassword()) });
      return;
    }
    if (message.type === 'IMPORT') {
      const vault = message.vault;
      if (vault?.version !== 2 || !vault.masterHash || !Array.isArray(vault.entries)) throw new Error('Este não é um backup compatível do Cerberus Vault.');
      if (vault.entries.some((entry) => !entry.id || !entry.site || !entry.encryptedPassword)) throw new Error('O backup contém entradas inválidas.');
      await lock();
      await chrome.storage.local.set({ vault });
      sendResponse({ ok: true, count: vault.entries.length });
      return;
    }
    if (message.type === 'UNLOCK') {
      const stored = await chrome.storage.local.get('vault');
      if (!stored.vault) throw new Error('Importe o cofre primeiro.');
      if (!(await verifyPassword(message.password, stored.vault.masterHash))) throw new Error('Senha mestra incorreta.');
      await keepUnlocked(message.password);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'LOCK') {
      await lock();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'MATCHES') {
      const password = await getPassword();
      if (!password) throw new Error('Cofre bloqueado.');
      const stored = await chrome.storage.local.get('vault');
      const hostname = normalizeHostname(message.url);
      const entries = stored.vault.entries.filter((entry) => entry.authType !== 'google' && normalizeHostname(entry.site) === hostname);
      await keepUnlocked(password);
      sendResponse({ hostname, entries: entries.map(({ id, site, username }) => ({ id, site, username })) });
      return;
    }
    if (message.type === 'FILL') {
      const password = await getPassword();
      if (!password) throw new Error('Cofre bloqueado.');
      const stored = await chrome.storage.local.get('vault');
      const entry = stored.vault.entries.find((candidate) => candidate.id === message.entryId);
      if (!entry) throw new Error('Credencial não encontrada.');
      const tab = await chrome.tabs.get(message.tabId);
      if (normalizeHostname(tab.url) !== normalizeHostname(entry.site)) throw new Error('O domínio aberto não corresponde à credencial.');
      const decryptedPassword = await decryptValue(entry.encryptedPassword, password);
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillLoginForm, args: [entry.username, decryptedPassword] });
      await keepUnlocked(password);
      sendResponse(results[0]?.result || { ok: false, message: 'Não foi possível preencher a página.' });
      return;
    }
    throw new Error('Operação desconhecida.');
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

function fillLoginForm(username, password) {
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const setInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inputs = [...document.querySelectorAll('input')].filter(isVisible);
  const passwordInput = inputs.find((input) => input.type === 'password' && !input.disabled && !input.readOnly);
  if (!passwordInput) return { ok: false, message: 'Nenhum campo de senha visível foi encontrado.' };
  const usernameTypes = new Set(['email', 'text', 'tel']);
  const candidates = inputs.filter((input) => usernameTypes.has(input.type || 'text') && !input.disabled && !input.readOnly);
  const usernameInput = candidates.filter((input) => input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1) || candidates[0];
  if (usernameInput) setInputValue(usernameInput, username);
  setInputValue(passwordInput, password);
  passwordInput.focus();
  return { ok: true, message: usernameInput ? 'Usuário e senha preenchidos.' : 'Senha preenchida.' };
}
