const SALT = "dude-secret-salt-2026";

// Hash aditivo simples para validar integridade
function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // Converter para inteiro de 32 bits
  }
  return hash;
}

// Função para ofuscar/criptografar
export function encryptData(text: string): string {
  try {
    // 1. Adicionar o Salt e um hash bem simples de validação para garantir integridade
    const payload = JSON.stringify({
      data: text,
      timestamp: Date.now(),
      hash: simpleHash(text)
    });
    
    // 2. Deslocamento de caracteres (Cifra de César simples no nível do character code)
    let shifted = '';
    for (let i = 0; i < payload.length; i++) {
      const charCode = payload.charCodeAt(i);
      const shift = 5 + (i % 7);
      shifted += String.fromCharCode(charCode + shift);
    }

    // 3. Transformação em Base64 seguro para URL
    return btoa(unescape(encodeURIComponent(shifted)));
  } catch (e) {
    console.error("Falha ao criptografar estado", e);
    return text;
  }
}

// Função para descriptografar com verificação de integridade e Fallback seguro (anti-crash)
export function decryptData(encoded: string): string | null {
  try {
    if (!encoded) return null;
    
    // Verificar se já é um JSON bruto (legado) para não quebrar compatibilidade
    const trimmed = encoded.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed === 'true' || trimmed === 'false') {
      return encoded;
    }

    // 1. Decodificar Base64
    const decodedBase64 = decodeURIComponent(escape(atob(encoded)));
    
    // 2. Reverter o deslocamento
    let unshifted = '';
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i);
      const shift = 5 + (i % 7);
      unshifted += String.fromCharCode(charCode - shift);
    }
    
    // 3. Converter de JSON e validar hash
    const parsed = JSON.parse(unshifted);
    if (parsed && typeof parsed === 'object' && 'hash' in parsed && 'data' in parsed) {
      const computedHash = simpleHash(parsed.data);
      if (parsed.hash === computedHash) {
        return parsed.data;
      }
    }
    
    return null;
  } catch (e) {
    // Fallback: se houver erro ao converter ou descriptografar, verifica se era legado
    try {
      const trimmed = encoded.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed === 'true' || trimmed === 'false') {
        return encoded;
      }
    } catch {
      // do nothing
    }
    console.warn("Falha ao descriptografar estado (dado pode estar corrompido ou modificado). Retornando null.");
    return null;
  }
}

// Backup dos métodos nativos brutas para evitar loops infinitos de recursão
const nativeGetItem = typeof window !== 'undefined' ? Storage.prototype.getItem : null;
const nativeSetItem = typeof window !== 'undefined' ? Storage.prototype.setItem : null;
const nativeRemoveItem = typeof window !== 'undefined' ? Storage.prototype.removeItem : null;
const nativeClear = typeof window !== 'undefined' ? Storage.prototype.clear : null;

export const secureLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined' || !nativeGetItem) return null;
    const rawValue = nativeGetItem.call(localStorage, key);
    if (!rawValue) return null;
    return decryptData(rawValue);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined' || !nativeSetItem) return;
    const encrypted = encryptData(value);
    nativeSetItem.call(localStorage, key, encrypted);
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined' || !nativeRemoveItem) return;
    nativeRemoveItem.call(localStorage, key);
  },
  clear: (): void => {
    if (typeof window === 'undefined' || !nativeClear) return;
    nativeClear.call(localStorage);
  }
};

// Aplica o monkeypatch em nível de ambiente para interceptar qualquer chamada de localStorage nativa do navegador
export function applySecureLocalStorage() {
  if (typeof window === 'undefined' || !window.Storage) return;

  // Garantir que aplicamos apenas uma vez
  if ((window as any).__secure_storage_applied__) return;
  (window as any).__secure_storage_applied__ = true;

  Storage.prototype.getItem = function (this: Storage, key: string): string | null {
    if (!nativeGetItem) return null;
    const rawValue = nativeGetItem.call(this, key);
    if (!rawValue) return null;
    return decryptData(rawValue);
  };

  Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
    if (!nativeSetItem) return;
    const encrypted = encryptData(value);
    nativeSetItem.call(this, key, encrypted);
  };

  Storage.prototype.removeItem = function (this: Storage, key: string): void {
    if (!nativeRemoveItem) return;
    nativeRemoveItem.call(this, key);
  };
}
