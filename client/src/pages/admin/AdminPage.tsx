import {useMemo, useState} from "react";
import {NavLink} from "react-router-dom";
import UsersService from "../../services/UsersService";
import AuthService from "../../services/AuthService";
import type {UserMeResponse} from "../../models/response/UserMeResponse";
import styles from './AdminPage.module.css';

function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isEmployeeId(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

const AdminPage = () => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<UserMeResponse | null>(null);

    const [changingRole, setChangingRole] = useState(false);
    const [revoking, setRevoking] = useState(false);

    const canLookup = useMemo(() => {
        const v = identifier.trim();
        return isEmail(v) || isEmployeeId(v);
    }, [identifier]);

    const handleLookup = async () => {
        if (!canLookup || loading) return;
        setLoading(true);
        setError(null);
        setUser(null);

        const v = identifier.trim();
        try {
            const res = await UsersService.lookupUser({
                ...(isEmail(v) ? { email: v } : { employee_Id: Number(v) }),
            });
            setUser(res.data);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Пользователь не найден');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRole = async () => {
        if (!user || changingRole) return;
        setChangingRole(true);
        setError(null);
        try {
            const newRole = user.role === 'admin' ? 'user' : 'admin';
            const res = await UsersService.setRole(user.id, newRole);
            setUser(res.data);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Не удалось изменить роль');
        } finally {
            setChangingRole(false);
        }
    };

    const handleRevokeSessions = async () => {
        if (!user || revoking) return;
        setRevoking(true);
        setError(null);
        try {
            await AuthService.deleteAllSessionsByUser(user.id);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Не удалось отключить сессии');
        } finally {
            setRevoking(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Админ панель</h1>
                    <p className={styles.subtitle}>Поиск пользователя и админ-действия</p>
                </div>
                <div className={styles.linkRow}>
                    <NavLink to={'/admin/register'} className={styles.link}>Регистрация</NavLink>
                </div>
            </div>

            <div className={styles.card}>
                <h2 className={styles.cardTitle}>Найти пользователя</h2>
                <div className={styles.row}>
                    <input
                        className={styles.input}
                        placeholder="Email или ID сотрудника"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    />
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleLookup}
                        disabled={!canLookup || loading}
                    >
                        {loading ? 'Поиск...' : 'Найти'}
                    </button>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {user && (
                    <div className={styles.userCard}>
                        <div className={styles.userName}>
                            {user.name} {user.surname}
                        </div>
                        <div className={styles.meta}>
                            {user.email} · ID: {user.employee_Id}
                        </div>

                        <div className={styles.badgeRow}>
                            <span className={styles.badge}>role: {user.role}</span>
                        </div>

                        <div className={styles.badgeRow}>
                            <button
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={handleToggleRole}
                                disabled={changingRole}
                            >
                                {changingRole
                                    ? 'Сохранение...'
                                    : user.role === 'admin'
                                        ? 'Сделать пользователем'
                                        : 'Сделать админом'}
                            </button>

                            <button
                                className={`${styles.btn} ${styles.btnDanger}`}
                                onClick={handleRevokeSessions}
                                disabled={revoking}
                            >
                                {revoking ? 'Отключение...' : 'Отключить все сессии'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;