import {useContext, useEffect, useState} from 'react';
import styles from './SessionsPage.module.css';
import AuthService from "../../services/AuthService";
import type {ISession} from "../../models/ISession";
import {Context} from "../../main";


function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getDeviceIcon(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
    );
}

export function SessionsPage() {
    const [sessions, setSessions] = useState<ISession[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const {store} = useContext(Context);

    const fetchSessions = async () => {
        try {
            const response = await AuthService.getSessions();
            setSessions(response.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleDelete = async (session: ISession) => {
        setDeletingId(session.id);
        try {
            await AuthService.deleteSession(session.id);

            if (session.isCurrent) {
                await store.logout();
            }

            setSessions((prev) => prev.filter((s) => s.id !== session.id));
        } catch (e) {
            console.error(e);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteAll = async () => {
        setDeletingAll(true);
        try {
            await AuthService.deleteAllOtherSessions();
            setSessions((prev) => prev.filter((s) => s.isCurrent));
        } catch (e) {
            console.error(e);
        } finally {
            setDeletingAll(false);
        }
    };

    const otherSessions = sessions.filter((s) => !s.isCurrent);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Активные сессии</h1>
                    <p className={styles.subtitle}>Устройства на которых вы авторизованы</p>
                </div>
                {otherSessions.length > 0 && (
                    <button
                        className={styles.dangerBtn}
                        onClick={handleDeleteAll}
                        disabled={deletingAll}
                    >
                        {deletingAll ? 'Завершение...' : 'Завершить все остальные'}
                    </button>
                )}
            </div>

            {loading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    Загрузка сессий...
                </div>
            ) : (
                <div className={styles.list}>
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className={`${styles.card} ${session.isCurrent ? styles.cardCurrent : ''}`}
                        >
                            <div className={styles.cardIcon}>
                                {getDeviceIcon(session.userAgent)}
                            </div>

                            <div className={styles.cardInfo}>
                                <div className={styles.cardTop}>
                                    <span className={styles.cardDevice}>{session.userAgent}</span>
                                    {session.isCurrent && (
                                        <span className={styles.currentBadge}>Текущая</span>
                                    )}
                                </div>
                                <div className={styles.cardMeta}>
                                    <span className={styles.cardIp}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="2" y1="12" x2="22" y2="12"/>
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                        </svg>
                                        {session.ip}
                                    </span>
                                    <span className={styles.cardDate}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        Вход: {formatDate(session.createdAt)}
                                    </span>
                                    <span className={styles.cardDate}>
                                        Истекает: {formatDate(session.expiresAt)}
                                    </span>
                                </div>
                            </div>

                             (
                                <button
                                    className={`${styles.deleteBtn} ${session.isCurrent ? styles.deleteBtnCurrent : ''}`}
                                    onClick={() => handleDelete(session)}
                                    disabled={deletingId === session.id}
                                    title={session.isCurrent ? 'Выйти на этом устройстве' : 'Завершить сессию'}
                                >
                                    {deletingId === session.id ? (
                                        <div className={styles.spinnerSmall} />
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"/>
                                            <line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    )}
                                </button>
                            )
                        </div>
                    ))}

                    {sessions.length === 0 && (
                        <div className={styles.empty}>Нет активных сессий</div>
                    )}
                </div>
            )}
        </div>
    );
}
