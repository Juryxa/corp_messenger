import {Outlet} from 'react-router-dom';
import {List} from '../components/List';
import styles from './MainLayout.module.css';

export function MainLayout() {
    return (
        <div className={styles.layout}>
            <List />
            <main className={styles.content}>
                <Outlet />
            </main>
        </div>
    );
}