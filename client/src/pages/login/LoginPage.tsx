import {useContext, useState} from 'react';
import {useForm} from 'react-hook-form';
import {Context} from '../../main';
import styles from './LoginPage.module.css';
import {useNavigate} from 'react-router-dom';
import {useCrypto} from '../../hooks/crypto-hooks/useCrypto';
import UsersService from "../../services/UsersService";

interface LoginFormData {
    identifier: string;
    password: string;
}

function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isEmployeeId(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

export function LoginPage() {
    const { store } = useContext(Context);
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);
    const { decryptPrivateKey, exportPrivateKey, savePrivateKeyToSession } = useCrypto();


    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({ mode: 'onTouched' });

    const onSubmit = async (data: LoginFormData) => {
        const { identifier, password } = data;
        setServerError(null);

        // 1. Логинимся
        let error: string | undefined;
        if (isEmail(identifier)) {
            error = await store.login(password, identifier, undefined);
        } else if (isEmployeeId(identifier)) {
            error = await store.login(password, undefined, Number(identifier));
        }

        if (error) {
            setServerError(error);
            return;
        }

        if (!store.isAuth) return;

        // 2. Если временный пароль — редиректим на смену, ключи ещё не генерировались
        if (store.isTemporaryPassword) {
            navigate('/change-password');
            return;
        }

        // 3. Загружаем зашифрованный приватный ключ и соль с сервера
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
        } catch {
            // Ключи ещё не созданы — не критично, просто идём дальше
            console.warn('Крипто-ключи не найдены');
        }

        navigate('/chats');
    };

    const validateIdentifier = (value: string) => {
        if (!value.trim()) return 'Введите email или ID работника';
        if (!isEmail(value) && !isEmployeeId(value)) {
            return 'Введите корректный email или числовой ID работника';
        }
        return true;
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginBox}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Корпоративный мессенджер</h1>
                    <p className={styles.subtitle}>Вход в систему</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    {serverError && (
                        <span className={styles.errorMsg}>{serverError}</span>
                    )}
                    <div className={styles.inputGroup}>
                        <label htmlFor="identifier" className={styles.label}>
                            Email или ID работника
                        </label>
                        <input
                            id="identifier"
                            type="text"
                            className={`${styles.input} ${errors.identifier ? styles.inputError : ''}`}
                            placeholder="example@company.com или 1337"
                            {...register('identifier', { validate: validateIdentifier })}
                        />
                        {errors.identifier && (
                            <span className={styles.errorMsg}>{errors.identifier.message}</span>
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password"
                            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                            placeholder="Введите пароль"
                            {...register('password', {
                                required: 'Введите пароль',
                                minLength: { value: 8, message: 'Пароль должен содержать не менее 8 символов' },
                                maxLength: { value: 128, message: 'Пароль не должен превышать 128 символов' },
                            })}
                        />
                        {errors.password && (
                            <span className={styles.errorMsg}>{errors.password.message}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Вход...' : 'Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
}