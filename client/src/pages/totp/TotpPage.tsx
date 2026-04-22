import {useContext, useEffect, useRef, useState} from 'react';
import {Context} from '../../main';
import styles from './TotpPage.module.css';
import UsersService from "../../services/UsersService";
import {useCrypto} from "../../hooks/crypto-hooks/useCrypto";

export function TotpPage() {
    const { store } = useContext(Context);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { decryptPrivateKey, exportPrivateKey, savePrivateKeyToSession } = useCrypto();

    // Автофокус при монтировании
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleCodeInput = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        setError(null);
    };

    const handleSubmit = async () => {
        if (code.length !== 6 || loading) return;

        setLoading(true);
        setError(null);

        const err = await store.submitTotp(code);

        if (err) {
            setError(err);
            setCode('');
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            // Успешно прошли TOTP → теперь загружаем приватный ключ
            try {
                const [keysRes, saltRes] = await Promise.all([
                    UsersService.getEncryptedPrivateKey(),
                    UsersService.getCryptoSalt(),
                ]);

                const privateKey = await decryptPrivateKey(
                    keysRes.data.encryptedPrivateKey,
                    store.getPasswordTemp(),
                    saltRes.data.cryptoSalt,
                );

                // Если удалось — отлично
                const privateKeyBase64 = await exportPrivateKey(privateKey);
                savePrivateKeyToSession(privateKeyBase64);
                store.markKeysAsLoaded();
            } catch {
                console.warn('Не удалось автоматически восстановить ключ после TOTP');
                // Оставляем needsKeyRestore = true — пользователь увидит RestoreKeyPage
            }
        }

        setLoading(false);
    };

    return (
        <div className={styles.root}>
            <div className={styles.bg}>
                <div className={styles.bgGlow}/>
                <div className={styles.bgGrid}/>
            </div>

            <div className={styles.card}>
                <div className={styles.iconBadge}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        <circle cx="12" cy="16" r="1" fill="currentColor"/>
                    </svg>
                </div>

                <h1 className={styles.title}>Двухфакторная аутентификация</h1>
                <p className={styles.subtitle}>
                    Введите 6-значный код из приложения аутентификатора
                </p>

                {/* Кликабельная обёртка — фокусирует скрытый input */}
                <div
                    className={styles.codeInputWrap}
                    onClick={() => inputRef.current?.focus()}
                >
                    {/* Реальный скрытый input */}
                    <input
                        ref={inputRef}
                        className={styles.codeInput}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={code}
                        onChange={e => handleCodeInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        autoComplete="one-time-code"
                        autoFocus
                    />
                    {/* Визуальные сегменты */}
                    <div className={styles.codeSegments}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className={`${styles.codeSegment}
                                    ${code[i] ? styles.codeSegmentFilled : ''}
                                    ${i === code.length ? styles.codeSegmentActive : ''}
                                    ${error ? styles.codeSegmentError : ''}`}
                            >
                                {code[i] ?? ''}
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className={styles.errorBanner}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                    </div>
                )}

                <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={code.length !== 6 || loading}
                >
                    {loading ? <><div className={styles.btnSpinner}/> Проверка...</> : 'Подтвердить'}
                </button>

                <p className={styles.hint}>Код обновляется каждые 30 секунд</p>
            </div>
        </div>
    );
}
