import {useCallback} from 'react';

const ECDH_ALGORITHM = {
    name: 'ECDH',
    namedCurve: 'P-256',
} as const;

// Вычисляем общий AES ключ из ECDH
async function deriveSharedAesKey(
    privateKey: CryptoKey,
    publicKey: CryptoKey,
): Promise<CryptoKey> {
    return window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: publicKey },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

// AES-GCM шифрование сырых байт
async function aesEncrypt(key: CryptoKey, data: BufferSource): Promise<Uint8Array> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data,
    );
    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), 12);
    return result;
}

// AES-GCM расшифровка
async function aesDecrypt(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    return window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted,
    );
}

export function useCrypto() {

    // ─── Генерация ключей ────────────────────────────────────────

    const generateKeyPair = useCallback(async () => {
        return window.crypto.subtle.generateKey(
            ECDH_ALGORITHM,
            true,
            ['deriveKey', 'deriveBits'],
        );
    }, []);

    const exportPublicKey = useCallback(async (key: CryptoKey): Promise<string> => {
        const exported = await window.crypto.subtle.exportKey('spki', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    }, []);

    const exportPrivateKey = useCallback(async (key: CryptoKey): Promise<string> => {
        const exported = await window.crypto.subtle.exportKey('pkcs8', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    }, []);

    const importPublicKey = useCallback(async (base64: string): Promise<CryptoKey> => {
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return window.crypto.subtle.importKey(
            'spki',
            binary,
            ECDH_ALGORITHM,
            true,
            [],
        );
    }, []);

    const importPrivateKey = useCallback(async (base64: string): Promise<CryptoKey> => {
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return window.crypto.subtle.importKey(
            'pkcs8',
            binary,
            ECDH_ALGORITHM,
            true,
            ['deriveKey', 'deriveBits'],
        );
    }, []);

    // ─── Шифрование приватного ключа паролем (AES-GCM + PBKDF2) ─

    const encryptPrivateKey = useCallback(async (
        privateKey: CryptoKey,
        password: string,
        saltBase64: string,
    ): Promise<string> => {
        const passwordKey = await deriveKeyFromPassword(password, saltBase64);
        const privateKeyBase64 = await exportPrivateKey(privateKey);
        const encoded = new TextEncoder().encode(privateKeyBase64);
        const encrypted = await aesEncrypt(passwordKey, encoded);
        return btoa(String.fromCharCode(...encrypted));
    }, [exportPrivateKey]);

    const decryptPrivateKey = useCallback(async (
        encryptedBase64: string,
        password: string,
        saltBase64: string,
    ): Promise<CryptoKey> => {
        const passwordKey = await deriveKeyFromPassword(password, saltBase64);
        const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const decrypted = await aesDecrypt(passwordKey, data);
        const privateKeyBase64 = new TextDecoder().decode(decrypted);
        return importPrivateKey(privateKeyBase64);
    }, [importPrivateKey]);

    // ─── Шифрование сообщения (direct) ───────────────────────────

    const encryptMessageHybrid = useCallback(async (
        text: string,
        recipientPublicKey: CryptoKey | null,
        senderPrivateKey: CryptoKey,
        senderPublicKeyBase64: string,
    ): Promise<{
        encryptedText: string;
        encryptedKeyRecipient: string | null;
        encryptedKeySender: string;
        senderPublicKey: string;
    }> => {
        // 1. Генерируем AES ключ для сообщения
        const aesKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt'],
        );

        // 2. Шифруем текст
        const rawText = new TextEncoder().encode(text);
        const encryptedTextBytes = await aesEncrypt(aesKey, rawText);
        const encryptedText = btoa(String.fromCharCode(...encryptedTextBytes));

        // 3. Экспортируем AES ключ
        const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

        // 4. Шифруем AES ключ для получателя через ECDH(privSender, pubRecipient)
        let encryptedKeyRecipient: string | null = null;
        if (recipientPublicKey) {
            const sharedWithRecipient = await deriveSharedAesKey(senderPrivateKey, recipientPublicKey);
            const enc = await aesEncrypt(sharedWithRecipient, rawAesKey);
            encryptedKeyRecipient = btoa(String.fromCharCode(...enc));
        }

        // 5. Шифруем AES ключ для себя — эфемерная пара
        const ephemeral = await window.crypto.subtle.generateKey(
            ECDH_ALGORITHM, true, ['deriveKey', 'deriveBits'],
        );
        const senderPubKey = await importPublicKey(senderPublicKeyBase64);
        const sharedWithSelf = await deriveSharedAesKey(ephemeral.privateKey, senderPubKey);

        const ephPubSpki = await window.crypto.subtle.exportKey('spki', ephemeral.publicKey);
        const ephPubBytes = new Uint8Array(ephPubSpki);
        const encSelf = await aesEncrypt(sharedWithSelf, rawAesKey);

        // Формат: [2 байта длина pubKey][pubKey][iv+encrypted]
        const senderKeyData = new Uint8Array(2 + ephPubBytes.byteLength + encSelf.byteLength);
        new DataView(senderKeyData.buffer).setUint16(0, ephPubBytes.byteLength);
        senderKeyData.set(ephPubBytes, 2);
        senderKeyData.set(encSelf, 2 + ephPubBytes.byteLength);
        const encryptedKeySender = btoa(String.fromCharCode(...senderKeyData));

        return {
            encryptedText,
            encryptedKeyRecipient,
            encryptedKeySender,
            senderPublicKey: senderPublicKeyBase64,
        };
    }, [importPublicKey]);


    // ─── Расшифровка сообщения ────────────────────────────────────
    const decryptMessageHybrid = useCallback(async (
        encryptedText: string,
        encryptedKey: string,
        privateKey: CryptoKey,
        isSelfMessage: boolean = false,
        senderPublicKeyBase64?: string,
    ): Promise<string> => {
        if (!encryptedKey) {
            throw new Error('Нет ключа для расшифровки');
        }

        const keyData = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
        let rawAesKey: ArrayBuffer;

        if (isSelfMessage) {
            // === Только для своих сообщений в DIRECT чатах (эфемерный ключ) ===
            const view = new DataView(keyData.buffer);
            const pubLen = view.getUint16(0);
            const ephPubBytes = keyData.slice(2, 2 + pubLen);
            const encSelf = keyData.slice(2 + pubLen);

            const ephemeralPub = await window.crypto.subtle.importKey(
                'spki', ephPubBytes, ECDH_ALGORITHM, true, []
            );

            const sharedSecret = await deriveSharedAesKey(privateKey, ephemeralPub);
            rawAesKey = await aesDecrypt(sharedSecret, encSelf);
        }
        else {
            // === Чужие direct + ВСЕ сообщения в группах/каналах ===
            if (!senderPublicKeyBase64) {
                throw new Error('Отсутствует senderPublicKeyBase64');
            }

            const senderPubKey = await importPublicKey(senderPublicKeyBase64);
            const sharedSecret = await deriveSharedAesKey(privateKey, senderPubKey);
            rawAesKey = await aesDecrypt(sharedSecret, keyData);
        }

        const aesKey = await window.crypto.subtle.importKey(
            'raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']
        );

        const textData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
        const decrypted = await aesDecrypt(aesKey, textData);

        return new TextDecoder().decode(decrypted);
    }, [importPublicKey]);

    // ─── Шифрование для групп/каналов ────────────────────────────

    const encryptMessageForGroup = useCallback(async (
        text: string,
        memberKeys: { userId: string; publicKey: CryptoKey }[],
        senderPrivateKey: CryptoKey,
        senderPublicKeyBase64: string,
    ): Promise<{
        encryptedText: string;
        groupKeys: { userId: string; encryptedKey: string }[];
        senderPublicKey: string;
    }> => {
        // 1. Генерируем AES ключ
        const aesKey = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt'],
        );

        // 2. Шифруем текст
        const rawText = new TextEncoder().encode(text);
        const encryptedTextBytes = await aesEncrypt(aesKey, rawText);
        const encryptedText = btoa(String.fromCharCode(...encryptedTextBytes));

        // 3. Экспортируем AES ключ
        const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

        // 4. Для каждого участника: ECDH(privSender, pubMember) → шифруем AES ключ
        const groupKeys = await Promise.all(
            memberKeys.map(async ({ userId, publicKey }) => {
                const shared = await deriveSharedAesKey(senderPrivateKey, publicKey);
                const enc = await aesEncrypt(shared, rawAesKey);
                return {
                    userId,
                    encryptedKey: btoa(String.fromCharCode(...enc)),
                };
            }),
        );

        return { encryptedText, groupKeys, senderPublicKey: senderPublicKeyBase64 };
    }, []);

    // ─── Session storage ─────────────────────────────────────────

    const savePrivateKeyToSession = useCallback((privateKeyBase64: string) => {
        sessionStorage.setItem('privateKey', privateKeyBase64);
    }, []);

    const loadPrivateKeyFromSession = useCallback(async (): Promise<CryptoKey | null> => {
        const base64 = sessionStorage.getItem('privateKey');
        if (!base64) return null;
        return importPrivateKey(base64);
    }, [importPrivateKey]);

    const generateSalt = useCallback((): string => {
        const salt = window.crypto.getRandomValues(new Uint8Array(32));
        return btoa(String.fromCharCode(...salt));
    }, []);

    return {
        generateKeyPair,
        exportPublicKey,
        exportPrivateKey,
        importPublicKey,
        encryptPrivateKey,
        decryptPrivateKey,
        encryptMessageHybrid,
        decryptMessageHybrid,
        encryptMessageForGroup,
        savePrivateKeyToSession,
        loadPrivateKeyFromSession,
        generateSalt,
    };
}

// ─── PBKDF2 ──────────────────────────────────────────────────────

async function deriveKeyFromPassword(password: string, saltBase64: string): Promise<CryptoKey> {
    const encoded = new TextEncoder().encode(password);
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const baseKey = await window.crypto.subtle.importKey(
        'raw', encoded, 'PBKDF2', false, ['deriveKey'],
    );
    return window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}