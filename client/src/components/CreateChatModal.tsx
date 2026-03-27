// components/CreateChatModal.tsx
import {useContext, useState} from 'react';
import {useForm} from 'react-hook-form';
import ChatService from '../services/ChatService';
import UsersService from '../services/UsersService';
import type {IChat} from '../models/chat/IChat';
import type {AxiosError} from 'axios';
import styles from './CreateChatModal.module.css';
import {Context} from "../main";

interface Props {
    onClose: () => void;
    onCreated: (chat: IChat) => void;
}

interface FormData {
    name: string;
    description?: string;
    memberSearch: string;
}

type ChatTypeCreate = 'group' | 'channel';

export function CreateChatModal({ onClose, onCreated }: Props) {
    const { store } = useContext(Context);
    const [type, setType] = useState<ChatTypeCreate>('group');
    const [members, setMembers] = useState<{ id: string; name: string; surname: string }[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>();
    const memberSearch = watch('memberSearch', '');

    const handleSearch = async () => {
        if (memberSearch.trim().length < 2) return;
        setSearching(true);
        try {
            const res = await UsersService.searchUsers(memberSearch.trim());
            setSearchResults(
                res.data.filter((u) =>
                    u.id !== store.user.id && // ← себя не показываем
                    !members.find((m) => m.id === u.id)
                )
            );
        } finally {
            setSearching(false);
        }
    };

    const addMember = (user: any) => {
        setMembers((prev) => [...prev, user]);
        setSearchResults([]);
    };

    const removeMember = (userId: string) => {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
    };

    const onSubmit = async (data: FormData) => {
        setError(null);
        try {
            const res = await ChatService.createChat({
                type,
                name: data.name,
                description: data.description,
                memberIds: members.map((m) => m.id),
            });
            onCreated(res.data);
            onClose();
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            setError(error.response?.data?.message ?? 'Ошибка создания');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Создать чат</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* Тип чата */}
                <div className={styles.typeToggle}>
                    <button
                        className={`${styles.typeBtn} ${type === 'group' ? styles.typeBtnActive : ''}`}
                        onClick={() => setType('group')}
                        type="button"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        Группа
                    </button>
                    <button
                        className={`${styles.typeBtn} ${type === 'channel' ? styles.typeBtnActive : ''}`}
                        onClick={() => setType('channel')}
                        type="button"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <line x1="18" y1="20" x2="18" y2="10"/>
                            <line x1="12" y1="20" x2="12" y2="4"/>
                            <line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                        Канал
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            {type === 'group' ? 'Название группы' : 'Название канала'}
                        </label>
                        <input
                            className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                            placeholder={type === 'group' ? 'Команда разработки' : 'Новости компании'}
                            {...register('name', { required: 'Введите название' })}
                        />
                        {errors.name && <span className={styles.error}>{errors.name.message}</span>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Описание (необязательно)</label>
                        <input
                            className={styles.input}
                            placeholder="Описание..."
                            {...register('description')}
                        />
                    </div>

                    {/* Добавление участников */}
                    <div className={styles.field}>
                        <label className={styles.label}>Участники</label>
                        <div className={styles.searchRow}>
                            <input
                                className={styles.input}
                                placeholder="Поиск по имени или email"
                                {...register('memberSearch')}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                            />
                            <button
                                type="button"
                                className={styles.searchBtn}
                                onClick={handleSearch}
                                disabled={searching}
                            >
                                Найти
                            </button>
                        </div>

                        {/* Результаты поиска */}
                        {searchResults.length > 0 && (
                            <div className={styles.searchResults}>
                                {searchResults.map((u) => (
                                    <div key={u.id} className={styles.searchItem} onClick={() => addMember(u)}>
                                        <span>{u.name} {u.surname}</span>
                                        <span className={styles.searchItemMeta}>{u.email}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Добавленные участники */}
                        {members.length > 0 && (
                            <div className={styles.membersList}>
                                {members.map((m) => (
                                    <div key={m.id} className={styles.memberTag}>
                                        {m.name} {m.surname}
                                        <button type="button" onClick={() => removeMember(m.id)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <span className={styles.error}>{error}</span>}

                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                        {isSubmitting ? 'Создание...' : `Создать ${type === 'group' ? 'группу' : 'канал'}`}
                    </button>
                </form>
            </div>
        </div>
    );
}