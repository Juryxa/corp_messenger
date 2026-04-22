import {useContext, useState} from 'react';
import {useForm} from 'react-hook-form';
import {Context} from '../../main';
import styles from './LoginPage.module.css';


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
    const [serverError, setServerError] = useState<string | null>(null);



    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({ mode: 'onTouched' });

    const onSubmit = async (data: LoginFormData) => {
        const { identifier, password } = data;
        setServerError(null);

        let error: string | undefined;

        if (isEmail(identifier)) {
            error = await store.login(password, identifier);
        } else if (isEmployeeId(identifier)) {
            error = await store.login(password, undefined, Number(identifier));
        }

        if (error) {
            setServerError(error);
            return;
        }

        if (store.isAwaitingTotp) {
            store.setPasswordTemp(password);
            return;
        }
    }

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