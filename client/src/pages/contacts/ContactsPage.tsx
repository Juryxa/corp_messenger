import {useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import UsersService from "../../services/UsersService";
import ChatService from "../../services/ChatService";
import type {UserSearchItem} from "../../models/response/UserSearchItem";
import styles from './ContactsPage.module.css';

function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isEmployeeId(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

const ContactsPage = () => {
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [identifier, setIdentifier] = useState('');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const canSearch = useMemo(() => query.trim().length >= 2, [query]);
    const canAdd = useMemo(() => {
        const v = identifier.trim();
        return isEmail(v) || isEmployeeId(v);
    }, [identifier]);

    const handleSearch = async () => {
        if (!canSearch || searching) return;
        setSearching(true);
        setSearchError(null);
        try {
            const res = await UsersService.searchUsers(query.trim());
            setResults(res.data);
        } catch (e: any) {
            setSearchError(e?.response?.data?.message ?? 'Не удалось выполнить поиск');
        } finally {
            setSearching(false);
        }
    };

    const createDirectChat = async (userId: string) => {
        const res = await ChatService.createChat({ type: 'direct', targetUserId: userId });
        // чат создан/найден — переходим в чаты
        if (res.data?.id) navigate('/chats');
    };

    const handleAddByIdentifier = async () => {
        if (!canAdd || adding) return;
        setAdding(true);
        setAddError(null);

        const v = identifier.trim();
        try {
            const lookup = await UsersService.lookupUser({
                ...(isEmail(v) ? { email: v } : { employee_Id: Number(v) }),
            });
            await createDirectChat(lookup.data.id);
            setIdentifier('');
        } catch (e: any) {
            setAddError(e?.response?.data?.message ?? 'Не удалось добавить пользователя');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Контакты</h1>
                    <p className={styles.subtitle}>Найдите сотрудника и создайте с ним чат</p>
                </div>
            </div>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Поиск пользователей</h2>
                    <div className={styles.row}>
                        <input
                            className={styles.input}
                            placeholder="Имя, фамилия или email (минимум 2 символа)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleSearch}
                            disabled={!canSearch || searching}
                        >
                            {searching ? 'Поиск...' : 'Найти'}
                        </button>
                    </div>

                    {searchError && <div className={styles.error}>{searchError}</div>}

                    <div className={styles.list}>
                        {results.map((u) => (
                            <div key={u.id} className={styles.item}>
                                <div>
                                    <div className={styles.name}>{u.name} {u.surname}</div>
                                    <div className={styles.meta}>
                                        {u.email} · ID: {u.employee_Id}
                                    </div>
                                </div>
                                <button
                                    className={styles.btn}
                                    onClick={() => createDirectChat(u.id)}
                                >
                                    Создать чат
                                </button>
                            </div>
                        ))}
                        {!searching && results.length === 0 && query.trim().length > 0 && (
                            <div className={styles.empty}>Ничего не найдено</div>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Добавить по email / ID</h2>
                    <div className={styles.row}>
                        <input
                            className={styles.input}
                            placeholder="example@company.com или 1337"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddByIdentifier()}
                        />
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleAddByIdentifier}
                            disabled={!canAdd || adding}
                        >
                            {adding ? 'Добавление...' : 'Добавить'}
                        </button>
                    </div>
                    {addError && <div className={styles.error}>{addError}</div>}
                    <div className={styles.empty}>
                        После добавления создаётся личный чат (если уже есть — будет использован существующий).
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;