import {useState} from 'react';
import {useCrypto} from '../hooks/crypto-hooks/useCrypto';
import UsersService from '../services/UsersService';
import styles from './RestoreKeyPage.module.css';

interface Props {
    onRestored: () => void;
}

export function RestoreKeyPage({ onRestored }: Props) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { decryptPrivateKey, exportPrivateKey, savePrivateKeyToSession } = useCrypto();

    const handleRestore = async () => {
        if (!password) return;
        setLoading(true);
        setError(null);

        try {
            const [keysRes, saltRes] = await Promise.all([
                UsersService.getEncryptedPrivateKey(),
                UsersService.getCryptoSalt(),
            ]);

            const privateKey = await decryptPrivateKey(
                keysRes.data.encryptedPrivateKey,
                password,
                saltRes.data.cryptoSalt,
            );

            const privateKeyBase64 = await exportPrivateKey(privateKey);
            savePrivateKeyToSession(privateKeyBase64);
            onRestored();
        } catch {
            setError('Неверный пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrap}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <h2 className={styles.title}>Подтвердите личность</h2>
                <p className={styles.subtitle}>
                    Для расшифровки сообщений введите ваш пароль
                </p>
                <div className={styles.field}>
                    <input
                        type="password"
                        className={`${styles.input} ${error ? styles.inputError : ''}`}
                        placeholder="Введите пароль"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRestore()}
                        autoFocus
                    />
                    {error && <span className={styles.error}>{error}</span>}
                </div>
                <button
                    className={styles.btn}
                    onClick={handleRestore}
                    disabled={!password || loading}
                >
                    {loading ? 'Проверка...' : 'Продолжить'}
                </button>
            </div>
        </div>
    );
}