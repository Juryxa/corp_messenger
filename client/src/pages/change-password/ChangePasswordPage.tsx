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
    const {store} = useContext(Context);
    const navigate = useNavigate();
    const {
        generateKeyPair,
        exportPublicKey,
        exportPrivateKey,
        encryptPrivateKey,
        savePrivateKeyToSession
    } = useCrypto();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: {errors, isSubmitting},
    } = useForm<ChangePasswordFormData>({mode: 'onTouched'});

    const newPassword = watch('newPassword');

    const onSubmit = async (data: ChangePasswordFormData) => {
        try {
            const response = await AuthService.changePassword({
                oldPassword: data.oldPassword,
                newPassword: data.newPassword,
            });

            localStorage.setItem('token', response.data.accessToken!);

            // 2. Генерируем крипто-ключи (как было)
            const keyPair = await generateKeyPair();
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
            const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

            const saltArray = window.crypto.getRandomValues(new Uint8Array(32));
            const cryptoSalt = btoa(String.fromCharCode(...saltArray));

            const encryptedPrivateKey = await encryptPrivateKey(
                keyPair.privateKey,
                data.newPassword,
                cryptoSalt,
            );

            await UsersService.saveKeys({ publicKey: publicKeyBase64, encryptedPrivateKey, cryptoSalt });
            savePrivateKeyToSession(privateKeyBase64);

            // 3. Снимаем temporary флаг
            store.setTemporaryPassword(false);
            store.markKeysAsLoaded();

            // 4. Если сервер сказал, что нужна настройка TOTP — ставим флаг
            //    App.tsx сам покажет TotpSetupPage
            if (response.data.requireTotpSetup) {
                store.setRequireTotpSetup(true);
                // НЕ navigate — App сам перерендерится
                return;
            }
            navigate('/chats');
        } catch (e: any) {
            const message = e.response?.data?.message ?? 'Произошла ошибка';
            if (message.toLowerCase().includes('пароль')) {
                setError('oldPassword', {message});
            } else {
                setError('root', {message});
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
                            {...register('oldPassword', {required: 'Введите временный пароль'})}
                        />
                        {errors.oldPassword && (
                            <span className={styles.error}>{errors.oldPassword.message}</span>
                        )}
                    </div>

                    <div className={styles.divider}/>

                    <div className={styles.field}>
                        <label className={styles.label}>Новый пароль</label>
                        <input
                            type="password"
                            className={`${styles.input} ${errors.newPassword ? styles.inputError : ''}`}
                            placeholder="Минимум 8 символов"
                            {...register('newPassword', {
                                required: 'Введите новый пароль',
                                minLength: {value: 8, message: 'Минимум 8 символов'},
                                maxLength: {value: 128, message: 'Максимум 128 символов'},
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
