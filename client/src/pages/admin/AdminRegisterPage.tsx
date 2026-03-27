import {useContext, useState} from 'react';
import {useForm} from 'react-hook-form';
import styles from './AdminRegisterPage.module.css';
import {Context} from "../../main";
import type {AxiosError} from 'axios';
import type {CreatedAccount} from "../../models/response/RegisterResponse";

interface RegisterFormData {
    name: string;
    surname: string;
    email: string;
    employee_Id: number;
    role: 'admin' | 'user';
}


export function AdminRegisterPage() {
    const {store} = useContext(Context);
    const [created, setCreated] = useState<CreatedAccount | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, isSubmitting},
    } = useForm<RegisterFormData>({mode: 'onTouched'});

    const onSubmit = async (data: RegisterFormData) => {
        setServerError(null);

        try {
            const response = await store.registration(
                data.name,
                data.surname,
                data.role,
                data.email,
                Number(data.employee_Id),
                'placeholder'
            );

            setCreated(response.data);
            reset();

        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            setServerError(error.response?.data?.message ?? 'Произошла ошибка');
        }
    };

    const handleCopy = () => {
        if (!created) return;
        navigator.clipboard.writeText(created.temporaryPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateAnother = () => {
        setCreated(null);
        setServerError(null);
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Создание сотрудника</h1>
                <p className={styles.subtitle}>Новый аккаунт получит одноразовый пароль</p>
            </div>

            {created ? (
                <div className={styles.successCard}>
                    <div className={styles.successIcon}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>
                    <h2 className={styles.successTitle}>Аккаунт создан</h2>
                    <p className={styles.successText}>
                        Передайте сотруднику одноразовый пароль. При первом входе его потребуется сменить.
                    </p>

                    <div className={styles.passwordBlock}>
                        <span className={styles.passwordLabel}>Одноразовый пароль</span>
                        <div className={styles.passwordRow}>
                            <code className={styles.password}>{created.temporaryPassword}</code>
                            <button className={styles.copyBtn} onClick={handleCopy}>
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
                                {copied ? 'Скопировано' : 'Копировать'}
                            </button>
                        </div>
                    </div>

                    <button className={styles.newBtn} onClick={handleCreateAnother}>
                        Создать ещё одного сотрудника
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Имя</label>
                            <input
                                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                                placeholder="Вячеслав"
                                {...register('name', {
                                    required: 'Введите имя',
                                    maxLength: {value: 80, message: 'Не более 80 символов'},
                                })}
                            />
                            {errors.name && <span className={styles.error}>{errors.name.message}</span>}
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Фамилия</label>
                            <input
                                className={`${styles.input} ${errors.surname ? styles.inputError : ''}`}
                                placeholder="Чернобаев"
                                {...register('surname', {
                                    required: 'Введите фамилию',
                                    maxLength: {value: 80, message: 'Не более 80 символов'},
                                })}
                            />
                            {errors.surname && <span className={styles.error}>{errors.surname.message}</span>}
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                            placeholder="employee@company.com"
                            {...register('email', {
                                required: 'Введите email',
                                pattern: {value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Некорректный email'},
                            })}
                        />
                        {errors.email && <span className={styles.error}>{errors.email.message}</span>}
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>ID сотрудника</label>
                            <input
                                type="number"
                                className={`${styles.input} ${errors.employee_Id ? styles.inputError : ''}`}
                                placeholder="1337"
                                {...register('employee_Id', {
                                    required: 'Введите ID',
                                    min: {value: 1, message: 'ID должен быть положительным'},
                                })}
                            />
                            {errors.employee_Id && <span className={styles.error}>{errors.employee_Id.message}</span>}
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Роль</label>
                            <select
                                className={styles.input}
                                {...register('role', {required: true})}
                            >
                                <option value="user">Пользователь</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                    </div>

                    {serverError && <span className={styles.error}>{serverError}</span>}

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Создание...' : 'Создать сотрудника'}
                    </button>
                </form>
            )}
        </div>
    );
}
