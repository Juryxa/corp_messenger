import {useContext} from 'react';
import {NavLink} from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import {Context} from '../main';
import styles from './List.module.css';

interface JwtPayload {
    role: 'admin' | 'user';
}

function getRole(): 'admin' | 'user' | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const decoded = jwtDecode<JwtPayload>(token);
        return decoded.role;
    } catch {
        return null;
    }
}

const NAV_ITEMS = [
    {
        to: '/chats',
        label: 'Чаты',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                 strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        ),
    },
    {
        to: '/contacts',
        label: 'Контакты',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                 strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        ),
    },
    {
        to: '/storage',
        label: 'Хранилище',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                 strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                <path
                    d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
        ),
    },
    {
        to: '/calendar',
        label: 'Календарь',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                 strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
        ),
    },
    {
        to: '/polls',
        label: 'Опросы',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                 strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
        ),
    },
];

const ADMIN_ITEM = {
    to: '/admin',
    label: 'Панель админа',
    icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
             strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
    ),
};

export function List() {
    const {store} = useContext(Context);
    const role = getRole();

    return (
        <nav className={styles.sidebar}>
            <div className={styles.logo}>
                <NavLink to={'/home'}>
                    <span className={styles.logoIcon}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
                        </svg>
                    </span>
                </NavLink>
            </div>

            <ul className={styles.navList}>
                {NAV_ITEMS.map((item) => (
                    <li key={item.to} className={styles.navItem}>
                        <NavLink
                            to={item.to}
                            className={({isActive}) =>
                                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                            }
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                        </NavLink>
                    </li>
                ))}

                {role === 'admin' && (
                    <li className={`${styles.navItem} ${styles.adminItem}`}>
                        <NavLink
                            to={ADMIN_ITEM.to}
                            className={({isActive}) =>
                                `${styles.navLink} ${styles.navLinkAdmin} ${isActive ? styles.navLinkActive : ''}`
                            }
                        >
                            <span className={styles.navIcon}>{ADMIN_ITEM.icon}</span>
                            <span className={styles.navLabel}>{ADMIN_ITEM.label}</span>
                        </NavLink>
                    </li>
                )}
            </ul>

            <div className={styles.bottom}>
                <button
                    className={styles.logoutBtn}
                    onClick={() => store.logout()}
                    title="Выйти"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                         strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span className={styles.navLabel}>Выйти</span>
                </button>
            </div>
        </nav>
    );
}
