import {useState} from 'react';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Здесь будет логика авторизации
        console.log('Login:', login, 'Password:', password);
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginBox}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Корпоративный мессенджер</h1>
                    <p className={styles.subtitle}>Вход в систему</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="login" className={styles.label}>
                            Логин / Почта / ID работника
                        </label>
                        <input
                            id="login"
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            className={styles.input}
                            placeholder="Введите логин, почту или ID"
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            placeholder="Введите пароль"
                            required
                        />
                    </div>

                    <button type="submit" className={styles.submitButton}>
                        Войти
                    </button>
                </form>

                <div className={styles.footer}>
                    <a href="#" className={styles.link}>
                        Забыли пароль?
                    </a>
                </div>
            </div>
        </div>
    );
}
