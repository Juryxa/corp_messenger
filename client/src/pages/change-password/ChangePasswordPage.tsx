import {useContext} from 'react';
import {useForm} from 'react-hook-form';
import {useNavigate} from 'react-router-dom';
import {Context} from '../../main';
import {useCrypto} from '../../hooks/crypto-hooks/useCrypto';
import AuthService from "../../services/AuthService";
import UsersService from "../../services/UsersService";
import styles from './ChangePasswordPage.module.css';

interface ChangePasswordFormData {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export function ChangePasswordPage() {
    const { store } = useContext(Context);
    const navigate = useNavigate();
    const { generateKeyPair, exportPublicKey, exportPrivateKey, encryptPrivateKey, savePrivateKeyToSession } = useCrypto();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<ChangePasswordFormData>({ mode: 'onTouched' });

    const newPassword = watch('newPassword');

    const onSubmit = async (data: ChangePasswordFormData) => {
        try {
            // 1. Меняем пароль
            const response = await AuthService.changePassword({
                oldPassword: data.oldPassword,
                newPassword: data.newPassword,
            });

            // Обновляем токен
            localStorage.setItem('token', response.data.accessToken);

            // 2. Генерируем крипто-ключи
            const keyPair = await generateKeyPair();
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
            const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

            // Генерируем соль
            const saltArray = window.crypto.getRandomValues(new Uint8Array(32));
            const cryptoSalt = btoa(String.fromCharCode(...saltArray));

            const encryptedPrivateKey = await encryptPrivateKey(
                keyPair.privateKey,
                data.newPassword,
                cryptoSalt,
            );

            // 3. Сохраняем ключи на сервере
            await UsersService.saveKeys({
                publicKey: publicKeyBase64,
                encryptedPrivateKey,
                cryptoSalt,
            });

            // 4. Кэшируем приватный ключ в sessionStorage
            savePrivateKeyToSession(privateKeyBase64);

            // 5. Снимаем флаг isTemporaryPassword
            store.setTemporaryPassword(false);

            navigate('/chats');
        } catch (e: any) {
            const message = e.response?.data?.message ?? 'Произошла ошибка';
            if (message.toLowerCase().includes('пароль')) {
                setError('oldPassword', { message });
            } else {
                setError('root', { message });
            }
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrap}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>

                <h1 className={styles.title}>Смена пароля</h1>
                <p className={styles.subtitle}>
                    Вы вошли с временным паролем. Для продолжения необходимо задать постоянный пароль.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    <div className={styles.field}>
                        <label className={styles.label}>Временный пароль</label>
                        <input
                            type="password"
                            className={`${styles.input} ${errors.oldPassword ? styles.inputError : ''}`}
                            placeholder="Введите временный пароль"
                            {...register('oldPassword', { required: 'Введите временный пароль' })}
                        />
                        {errors.oldPassword && (
                            <span className={styles.error}>{errors.oldPassword.message}</span>
                        )}
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.field}>
                        <label className={styles.label}>Новый пароль</label>
                        <input
                            type="password"
                            className={`${styles.input} ${errors.newPassword ? styles.inputError : ''}`}
                            placeholder="Минимум 8 символов"
                            {...register('newPassword', {
                                required: 'Введите новый пароль',
                                minLength: { value: 8, message: 'Минимум 8 символов' },
                                maxLength: { value: 128, message: 'Максимум 128 символов' },
                            })}
                        />
                        {errors.newPassword && (
                            <span className={styles.error}>{errors.newPassword.message}</span>
                        )}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Подтвердите пароль</label>
                        <input
                            type="password"
                            className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                            placeholder="Повторите новый пароль"
                            {...register('confirmPassword', {
                                required: 'Подтвердите пароль',
                                validate: (v) => v === newPassword || 'Пароли не совпадают',
                            })}
                        />
                        {errors.confirmPassword && (
                            <span className={styles.error}>{errors.confirmPassword.message}</span>
                        )}
                    </div>

                    {errors.root && (
                        <span className={styles.error}>{errors.root.message}</span>
                    )}

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Сохранение...' : 'Сохранить и продолжить'}
                    </button>
                </form>
            </div>
        </div>
    );
}
