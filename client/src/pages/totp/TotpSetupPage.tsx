import {useContext, useEffect, useRef, useState} from 'react';
import {Context} from '../../main';
import AuthService from '../../services/AuthService';
import styles from './TotpSetupPage.module.css';

type Step = 'loading' | 'scan' | 'confirm' | 'done';

export function TotpSetupPage() {
    const { store } = useContext(Context);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<Step>('loading');
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [secretVisible, setSecretVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Автофокус при монтировании
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        AuthService.setupTotp()
            .then((res) => {
                setQrCode(res.data.qrCodeDataUrl);
                setSecret(res.data.secret);
                setStep('scan');
            })
            .catch(() => setStep('scan'));
    }, []);

    const handleCodeInput = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        setError(null);
    };

    const handleConfirm = async () => {
        if (code.length !== 6 || confirming) return;
        setConfirming(true);
        setError(null);
        try {
            await AuthService.confirmTotp(code);
            setStep('done');
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Неверный код');
        } finally {
            setConfirming(false);
        }
    };

    const handleDone = () => {
        store.setRequireTotpSetup(false);
        // navigate больше не нужен — App сам покажет /chats
    };

    const handleCopySecret = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async () => {
        if (code.length !== 6 || loading) return;
        setLoading(true);
        const err = await store.submitTotp(code);
        if (err) {
            setError(err);
            setCode('');
            // После ошибки снова фокусируем
            setTimeout(() => inputRef.current?.focus(), 50);
        }
        setLoading(false);
    };

    return (
        <div className={styles.root}>
            {/* Animated background */}
            <div className={styles.bg}>
                <div className={styles.bgGlow1}/>
                <div className={styles.bgGlow2}/>
                <div className={styles.bgGrid}/>
            </div>

            <div className={styles.card}>
                {/* Progress indicator */}
                <div className={styles.progress}>
                    <div className={`${styles.progressStep} ${step !== 'loading' ? styles.progressStepDone : ''}`}>
                        <span className={styles.progressNum}>1</span>
                        <span className={styles.progressLabel}>Сканировать</span>
                    </div>
                    <div className={`${styles.progressLine} ${(step === 'confirm' || step === 'done') ? styles.progressLineDone : ''}`}/>
                    <div className={`${styles.progressStep} ${(step === 'confirm' || step === 'done') ? styles.progressStepDone : ''}`}>
                        <span className={styles.progressNum}>2</span>
                        <span className={styles.progressLabel}>Подтвердить</span>
                    </div>
                    <div className={`${styles.progressLine} ${step === 'done' ? styles.progressLineDone : ''}`}/>
                    <div className={`${styles.progressStep} ${step === 'done' ? styles.progressStepDone : ''}`}>
                        <span className={styles.progressNum}>3</span>
                        <span className={styles.progressLabel}>Готово</span>
                    </div>
                </div>

                {/* Step: loading */}
                {step === 'loading' && (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner}/>
                        <p>Генерация ключа...</p>
                    </div>
                )}

                {/* Step: scan QR */}
                {step === 'scan' && (
                    <div className={styles.scanStep}>
                        <div className={styles.iconBadge}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="2" y="2" width="8" height="8" rx="1.5"/>
                                <rect x="14" y="2" width="8" height="8" rx="1.5"/>
                                <rect x="2" y="14" width="8" height="8" rx="1.5"/>
                                <rect x="4" y="4" width="4" height="4"/>
                                <rect x="16" y="4" width="4" height="4"/>
                                <rect x="4" y="16" width="4" height="4"/>
                                <path d="M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h4v4h-4z"/>
                            </svg>
                        </div>

                        <h1 className={styles.title}>Настройка двухфакторной аутентификации</h1>
                        <p className={styles.subtitle}>
                            Отсканируйте QR-код в приложении Google Authenticator, Authy или любом другом TOTP-совместимом приложении
                        </p>

                        <div className={styles.qrWrap}>
                            {qrCode ? (
                                <img src={qrCode} alt="QR-код для TOTP" className={styles.qrImage}/>
                            ) : (
                                <div className={styles.qrSkeleton}/>
                            )}
                            <div className={styles.qrCorner} style={{ top: 0, left: 0 }}/>
                            <div className={styles.qrCorner} style={{ top: 0, right: 0 }}/>
                            <div className={styles.qrCorner} style={{ bottom: 0, left: 0 }}/>
                            <div className={styles.qrCorner} style={{ bottom: 0, right: 0 }}/>
                        </div>

                        {/* Manual secret */}
                        <div className={styles.secretBlock}>
                            <span className={styles.secretLabel}>Ключ для ручного ввода</span>
                            <div className={styles.secretRow}>
                                <code className={styles.secretCode}>
                                    {secretVisible ? secret : secret.replace(/./g, '•')}
                                </code>
                                <button className={styles.secretBtn} onClick={() => setSecretVisible(v => !v)} title="Показать/скрыть">
                                    {secretVisible ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                                <button className={styles.secretBtn} onClick={handleCopySecret} title="Копировать">
                                    {copied ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className={styles.appHints}>
                            <span className={styles.appHintsLabel}>Рекомендуемые приложения:</span>
                            <div className={styles.appList}>
                                <span className={styles.appItem}>Google Authenticator</span>
                                <span className={styles.appDot}/>
                                <span className={styles.appItem}>Authy</span>
                                <span className={styles.appDot}/>
                                <span className={styles.appItem}>Microsoft Authenticator</span>
                            </div>
                        </div>

                        <button className={styles.primaryBtn} onClick={() => setStep('confirm')}>
                            Отсканировал, продолжить
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>
                )}

                {/* Step: confirm code */}
                {step === 'confirm' && (
                    <div className={styles.confirmStep}>
                        <div className={styles.iconBadge} style={{ background: 'rgba(79,142,247,0.15)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="11" width="18" height="11" rx="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                            </svg>
                        </div>

                        <h1 className={styles.title}>Введите код подтверждения</h1>
                        <p className={styles.subtitle}>
                            Откройте приложение аутентификатора и введите текущий 6-значный код для завершения настройки
                        </p>

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

                        <div className={styles.btnRow}>
                            <button className={styles.ghostBtn} onClick={() => { setStep('scan'); setCode(''); setError(null); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 18 9 12 15 6"/>
                                </svg>
                                Назад
                            </button>
                            <button
                                className={styles.primaryBtn}
                                onClick={handleConfirm}
                                disabled={code.length !== 6 || confirming}
                            >
                                {confirming ? (
                                    <><div className={styles.btnSpinner}/> Проверка...</>
                                ) : (
                                    <>Подтвердить</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: done */}
                {step === 'done' && (
                    <div className={styles.doneStep}>
                        <div className={styles.doneIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <h1 className={styles.title}>Двухфакторная аутентификация включена</h1>
                        <p className={styles.subtitle}>
                            Теперь при каждом входе в систему будет запрашиваться код из приложения аутентификатора. Не удаляйте приложение и сохраните секретный ключ в надёжном месте.
                        </p>
                        <div className={styles.doneNote}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            Ваш аккаунт теперь защищён двумя факторами
                        </div>
                        <button className={styles.primaryBtn} onClick={handleDone}>
                            Перейти в приложение
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
