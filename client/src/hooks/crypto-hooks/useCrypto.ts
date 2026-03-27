import {useCallback} from 'react';

const ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
};

export function useCrypto() {

    // ─── Генерация пары ключей ───────────────────────────────────

    const generateKeyPair = useCallback(async () => {
        const keyPair = await window.crypto.subtle.generateKey(
            ALGORITHM,
            true, // extractable — можно экспортировать
            ['encrypt', 'decrypt'],
        );
        return keyPair;
    }, []);

    // ─── Экспорт ключей в base64 ─────────────────────────────────

    const exportPublicKey = useCallback(async (key: CryptoKey): Promise<string> => {
        const exported = await window.crypto.subtle.exportKey('spki', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    }, []);

    const exportPrivateKey = useCallback(async (key: CryptoKey): Promise<string> => {
        const exported = await window.crypto.subtle.exportKey('pkcs8', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    }, []);

    // ─── Импорт ключей из base64 ─────────────────────────────────

    const importPublicKey = useCallback(async (base64: string): Promise<CryptoKey> => {
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        return window.crypto.subtle.importKey(
            'spki',
            binary,
            ALGORITHM,
            true,
            ['encrypt'],
        );
    }, []);

    const importPrivateKey = useCallback(async (base64: string): Promise<CryptoKey> => {
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        return window.crypto.subtle.importKey(
            'pkcs8',
            binary,
            ALGORITHM,
            true,
            ['decrypt'],
        );
    }, []);

    // ─── Шифрование приватного ключа паролем ─────────────────────
    // Используем AES-GCM — симметричное шифрование паролем

    const encryptPrivateKey = useCallback(async (
        privateKey: CryptoKey,
        password: string,
        saltBase64: string
    ): Promise<string> => {
        const passwordKey = await deriveKeyFromPassword(password, saltBase64);
        const privateKeyBase64 = await exportPrivateKey(privateKey);
        const encoded = new TextEncoder().encode(privateKeyBase64);

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            passwordKey,
            encoded,
        );

        // Сохраняем iv + зашифрованные данные вместе
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv, 0);
        result.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...result));
    }, [exportPrivateKey]);

    const decryptPrivateKey = useCallback(async (
        encryptedBase64: string,
        password: string,
        saltBase64: string,
    ): Promise<CryptoKey> => {
        const passwordKey = await deriveKeyFromPassword(password, saltBase64);
        const data = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

        const iv = data.slice(0, 12);
        const encrypted = data.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            passwordKey,
            encrypted,
        );

        const privateKeyBase64 = new TextDecoder().decode(decrypted);
        return importPrivateKey(privateKeyBase64);
    }, [importPrivateKey]);

    // ─── Шифрование сообщения ────────────────────────────────────

    const encryptMessage = useCallback(async (
        text: string,
        recipientPublicKey: CryptoKey,
    ): Promise<string> => {
        const encoded = new TextEncoder().encode(text);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            recipientPublicKey,
            encoded,
        );
        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    }, []);

    // ─── Расшифровка сообщения ───────────────────────────────────

    const decryptMessage = useCallback(async (
        encryptedBase64: string,
        privateKey: CryptoKey,
    ): Promise<string> => {
        const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privateKey,
            encrypted,
        );
        return new TextDecoder().decode(decrypted);
    }, []);

    // ─── Кэш приватного ключа в памяти ───────────────────────────
    // Чтобы не расшифровывать каждый раз из пароля

    const savePrivateKeyToSession = useCallback((privateKeyBase64: string) => {
        sessionStorage.setItem('privateKey', privateKeyBase64);
    }, []);

    const loadPrivateKeyFromSession = useCallback(async (): Promise<CryptoKey | null> => {
        const base64 = sessionStorage.getItem('privateKey');
        if (!base64) return null;
        return importPrivateKey(base64);
    }, [importPrivateKey]);

    const clearPrivateKeyFromSession = useCallback(() => {
        sessionStorage.removeItem('privateKey');
    }, []);

    const generateSalt = useCallback((): string => {
        const salt = window.crypto.getRandomValues(new Uint8Array(32));
        return btoa(String.fromCharCode(...salt));
    }, []);

    return {
        generateKeyPair,
        exportPublicKey,
        exportPrivateKey,
        importPublicKey,
        importPrivateKey,
        encryptPrivateKey,
        decryptPrivateKey,
        encryptMessage,
        decryptMessage,
        savePrivateKeyToSession,
        loadPrivateKeyFromSession,
        clearPrivateKeyFromSession,
        generateSalt
    };
}

// ─── Вспомогательная функция — производим ключ AES из пароля ────

// deriveKeyFromPassword теперь принимает соль
async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
    const encoded = new TextEncoder().encode(password);
    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoded,
        'PBKDF2',
        false,
        ['deriveKey'],
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,            // ← уникальная соль
            iterations: 100000,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}