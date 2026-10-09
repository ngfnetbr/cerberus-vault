const STORAGE_KEY = 'encryptedVault';
const LEGACY_STORAGE_KEY = 'vault';
const SESSION_PASSWORD_KEY = 'cerberus_master_password';
const LOCK_ALARM = 'cerberus_auto_lock';
const LOCK_MINUTES = 5;
const PBKDF2_ITERATIONS = 600000;
const VAULT_MAGIC = 'CERBERUS_VAULT_V3';
const LEGACY_VERIFICATION_TOKEN = 'VAULT_VERIFICATION_TOKEN';

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveKey(password, salt, usages) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

async function encryptVault(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return {
    version: 3,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
    cipher: 'AES-256-GCM',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

async function decryptVault(vault, password) {
  if (vault?.version !== 3 || !vault.salt || !vault.iv || !vault.ciphertext) throw new Error('Backup incompatível.');
  const salt = base64ToBytes(vault.salt);
  const iv = base64ToBytes(vault.iv);
  const key = await deriveKey(password, salt, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(vault.ciphertext));
  const payload = JSON.parse(new TextDecoder().decode(plaintext));
  if (payload?.magic !== VAULT_MAGIC || !Array.isArray(payload.entries)) throw new Error('Senha incorreta ou cofre inválido.');
  return payload;
}

async function decryptLegacyValue(encryptedValue, password) {
  const [saltValue, ivValue, ciphertextValue] = encryptedValue.split('.');
  if (!saltValue || !ivValue || !ciphertextValue) throw new Error('Formato legado inválido.');
  const salt = base64ToBytes(saltValue);
  const iv = base64ToBytes(ivValue);
  const key = await deriveKey(password, salt, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(ciphertextValue));
  return new TextDecoder().decode(plaintext);
}

async function verifyLegacyPassword(password, masterHash) {
  try { return (await decryptLegacyValue(masterHash, password)) === LEGACY_VERIFICATION_TOKEN; }
  catch { return false; }
}

function normalizeHostname(value) {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(candidate).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

function validateEntry(entry) {
  if (!entry.site?.trim()) throw new Error('Informe o site.');
  if (!normalizeHostname(entry.site)) throw new Error('Informe um domínio válido.');
  if (!entry.username?.trim()) throw new Error('Informe o usuário ou e-mail.');
  if (!entry.password) throw new Error('Informe a senha.');
}

async function getStoredVault() {
  const data = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  return { vault: data[STORAGE_KEY] || null, legacy: data[LEGACY_STORAGE_KEY] || null };
}

async function saveVault(vault) {
  await chrome.storage.local.set({ [STORAGE_KEY]: vault });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
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

async function requirePayload() {
  const password = await getPassword();
  if (!password) throw new Error('Cofre bloqueado.');
  const { vault } = await getStoredVault();
  if (!vault) throw new Error('Cofre não encontrado.');
  const payload = await decryptVault(vault, password);
  await keepUnlocked(password);
  return { password, payload };
}

async function migrateLegacy(legacy, password) {
  if (!legacy?.masterHash || !Array.isArray(legacy.entries)) throw new Error('Backup legado inválido.');
  if (!(await verifyLegacyPassword(password, legacy.masterHash))) throw new Error('Senha mestra incorreta.');
  const entries = await Promise.all(legacy.entries.map(async entry => ({
    id: entry.id || crypto.randomUUID(),
    site: entry.site || '',
    username: entry.username || '',
    password: entry.authType === 'google' ? '' : await decryptLegacyValue(entry.encryptedPassword, password),
    notes: entry.notes || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  })));
  const payload = { magic: VAULT_MAGIC, entries: entries.filter(entry => entry.password), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveVault(await encryptVault(payload, password));
  return payload;
}

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === LOCK_ALARM) lock(); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'STATUS') {
      const { vault, legacy } = await getStoredVault();
      sendResponse({ imported: Boolean(vault || legacy), unlocked: Boolean(await getPassword()), version: vault?.version || legacy?.version || null });
      return;
    }

    if (message.type === 'CREATE') {
      if (typeof message.password !== 'string' || message.password.length < 10) throw new Error('A senha mestra deve ter pelo menos 10 caracteres.');
      const now = new Date().toISOString();
      const payload = { magic: VAULT_MAGIC, entries: [], createdAt: now, updatedAt: now };
      await saveVault(await encryptVault(payload, message.password));
      await keepUnlocked(message.password);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'IMPORT') {
      const vault = message.vault;
      if (vault?.version === 3 && vault.salt && vault.iv && vault.ciphertext) {
        await lock();
        await saveVault(vault);
        sendResponse({ ok: true, version: 3 });
        return;
      }
      if (vault?.version === 2 && vault.masterHash && Array.isArray(vault.entries)) {
        await lock();
        await chrome.storage.local.set({ [LEGACY_STORAGE_KEY]: vault });
        await chrome.storage.local.remove(STORAGE_KEY);
        sendResponse({ ok: true, version: 2, count: vault.entries.length });
        return;
      }
      throw new Error('Este não é um backup compatível do Cerberus Vault.');
    }

    if (message.type === 'UNLOCK') {
      const { vault, legacy } = await getStoredVault();
      if (!vault && !legacy) throw new Error('Crie ou importe um cofre primeiro.');
      try {
        if (vault) await decryptVault(vault, message.password);
        else await migrateLegacy(legacy, message.password);
      } catch { throw new Error('Senha mestra incorreta.'); }
      await keepUnlocked(message.password);
      sendResponse({ ok: true, migrated: Boolean(legacy && !vault) });
      return;
    }

    if (message.type === 'LOCK') {
      await lock();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'LIST') {
      const { payload } = await requirePayload();
      sendResponse({ entries: payload.entries.map(entry => ({ ...entry })) });
      return;
    }

    if (message.type === 'SAVE_ENTRY') {
      const { password, payload } = await requirePayload();
      const input = message.entry || {};
      validateEntry(input);
      const now = new Date().toISOString();
      const existingIndex = payload.entries.findIndex(entry => entry.id === input.id);
      const entry = {
        id: existingIndex >= 0 ? input.id : crypto.randomUUID(),
        site: input.site.trim(), username: input.username.trim(), password: input.password,
        notes: (input.notes || '').trim(), createdAt: existingIndex >= 0 ? payload.entries[existingIndex].createdAt : now, updatedAt: now,
      };
      if (existingIndex >= 0) payload.entries[existingIndex] = entry; else payload.entries.push(entry);
      payload.updatedAt = now;
      await saveVault(await encryptVault(payload, password));
      sendResponse({ ok: true, entry });
      return;
    }

    if (message.type === 'DELETE_ENTRY') {
      const { password, payload } = await requirePayload();
      payload.entries = payload.entries.filter(entry => entry.id !== message.entryId);
      payload.updatedAt = new Date().toISOString();
      await saveVault(await encryptVault(payload, password));
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'CHANGE_PASSWORD') {
      const { payload } = await requirePayload();
      if (typeof message.password !== 'string' || message.password.length < 10) throw new Error('A nova senha deve ter pelo menos 10 caracteres.');
      await saveVault(await encryptVault(payload, message.password));
      await keepUnlocked(message.password);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'EXPORT') {
      await requirePayload();
      const { vault } = await getStoredVault();
      sendResponse({ vault });
      return;
    }

    if (message.type === 'MATCHES') {
      const { payload } = await requirePayload();
      const hostname = normalizeHostname(message.url);
      const entries = payload.entries.filter(entry => normalizeHostname(entry.site) === hostname);
      sendResponse({ hostname, entries: entries.map(({ id, site, username }) => ({ id, site, username })) });
      return;
    }

    if (message.type === 'FILL') {
      const { payload } = await requirePayload();
      const entry = payload.entries.find(candidate => candidate.id === message.entryId);
      if (!entry) throw new Error('Credencial não encontrada.');
      const tab = await chrome.tabs.get(message.tabId);
      if (normalizeHostname(tab.url) !== normalizeHostname(entry.site)) throw new Error('O domínio aberto não corresponde à credencial.');
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillLoginForm, args: [entry.username, entry.password] });
      sendResponse(results[0]?.result || { ok: false, message: 'Não foi possível preencher a página.' });
      return;
    }

    throw new Error('Operação desconhecida.');
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

function fillLoginForm(username, password) {
  const isVisible = element => { const style = window.getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0; };
  const setInputValue = (input, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const inputs = [...document.querySelectorAll('input')].filter(isVisible);
  const passwordInput = inputs.find(input => input.type === 'password' && !input.disabled && !input.readOnly);
  if (!passwordInput) return { ok: false, message: 'Nenhum campo de senha visível foi encontrado.' };
  const candidates = inputs.filter(input => ['email', 'text', 'tel'].includes(input.type || 'text') && !input.disabled && !input.readOnly);
  const usernameInput = candidates.filter(input => input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1) || candidates[0];
  if (usernameInput) setInputValue(usernameInput, username);
  setInputValue(passwordInput, password);
  passwordInput.focus();
  return { ok: true, message: usernameInput ? 'Usuário e senha preenchidos.' : 'Senha preenchida.' };
}
