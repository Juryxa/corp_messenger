import {useContext, useEffect, useState} from 'react';
import {Context} from '../../main';
import PollsService from '../../services/PollService';
import type {IPoll} from '../../models/polls/IPoll';
import styles from './PollsPage.module.css';

// ─── Хелперы ─────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

function isActive(poll: IPoll): boolean {
    const now = new Date();
    return new Date(poll.startsAt) <= now && new Date(poll.endsAt) >= now;
}

function daysLeft(endsAt: string): number {
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

type Tab = 'active' | 'finished' | 'all';
type View = 'list' | 'detail' | 'create';

// ─── Компонент карточки опроса ────────────────────────────────────

function PollCard({ poll, onClick }: { poll: IPoll; onClick: () => void }) {
    const active = isActive(poll);

    return (
        <div className={`${styles.card} ${active ? styles.cardActive : styles.cardFinished}`} onClick={onClick}>
            <div className={styles.cardTop}>
                <div className={styles.cardBadges}>
                    <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeFinished}`}>
                        {active ? 'Активен' : 'Завершён'}
                    </span>
                    <span className={styles.badge}>
                        {poll.type === 'single' ? 'Один ответ' : 'Несколько ответов'}
                    </span>
                    {poll.isAnonymous && <span className={`${styles.badge} ${styles.badgeAnon}`}>Анонимный</span>}
                </div>
                {poll.hasVoted && (
                    <span className={styles.votedBadge}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Вы проголосовали
                    </span>
                )}
            </div>

            <h3 className={styles.cardTitle}>{poll.title}</h3>
            {poll.description && <p className={styles.cardDesc}>{poll.description}</p>}

            <div className={styles.cardMeta}>
                <span className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {poll.creator.name} {poll.creator.surname}
                </span>
                <span className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                    </svg>
                    {formatDate(poll.startsAt)} — {formatDate(poll.endsAt)}
                </span>
                <span className={styles.metaItem}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {poll.totalVoters} голосов
                </span>
                {active && (
                    <span className={styles.metaItem}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {daysLeft(poll.endsAt) === 0 ? 'Последний день' : `${daysLeft(poll.endsAt)} дн. осталось`}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Детальная страница опроса ────────────────────────────────────

function PollDetail({ pollId, onBack, isAdmin }: {
    pollId: string;
    onBack: () => void;
    isAdmin: boolean;
}) {
    const [poll, setPoll] = useState<IPoll | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string[]>([]);
    const [voting, setVoting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        PollsService.getPoll(pollId)
            .then((res) => setPoll(res.data))
            .finally(() => setLoading(false));
    }, [pollId]);

    const handleSelect = (optionId: string) => {
        if (!poll || poll.hasVoted || !isActive(poll)) return;
        if (poll.type === 'single') {
            setSelected([optionId]);
        } else {
            setSelected((prev) =>
                prev.includes(optionId)
                    ? prev.filter((id) => id !== optionId)
                    : [...prev, optionId]
            );
        }
    };

    const handleVote = async () => {
        if (!poll || selected.length === 0 || voting) return;
        setVoting(true);
        setError(null);
        try {
            const res = await PollsService.vote(poll.id, selected);
            setPoll(res.data);
            setSelected([]);
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Ошибка голосования');
        } finally {
            setVoting(false);
        }
    };

    const handleDelete = async () => {
        if (!poll) return;
        await PollsService.deletePoll(poll.id);
        onBack();
    };

    if (loading) return <div className={styles.loading}>Загрузка...</div>;
    if (!poll) return <div className={styles.loading}>Опрос не найден</div>;

    const active = isActive(poll);
    const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 1);

    return (
        <div className={styles.detail}>
            <div className={styles.detailHeader}>
                <button className={styles.backBtn} onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Назад
                </button>
                {isAdmin && (
                    <button className={styles.deleteBtn} onClick={handleDelete}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                        </svg>
                        Удалить
                    </button>
                )}
            </div>

            <div className={styles.detailContent}>
                <div className={styles.detailBadges}>
                    <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeFinished}`}>
                        {active ? 'Активен' : 'Завершён'}
                    </span>
                    <span className={styles.badge}>{poll.type === 'single' ? 'Один ответ' : 'Несколько ответов'}</span>
                    {poll.isAnonymous && <span className={`${styles.badge} ${styles.badgeAnon}`}>Анонимный</span>}
                </div>

                <h1 className={styles.detailTitle}>{poll.title}</h1>
                {poll.description && <p className={styles.detailDesc}>{poll.description}</p>}

                <div className={styles.detailMeta}>
                    <span>Создал: {poll.creator.name} {poll.creator.surname}</span>
                    <span>{formatDate(poll.startsAt)} — {formatDate(poll.endsAt)}</span>
                    <span>{poll.totalVoters} участников</span>
                </div>

                {/* Варианты */}
                <div className={styles.options}>
                    {poll.options.map((opt) => {
                        const isSelected = selected.includes(opt.id);
                        const pct = poll.totalVoters > 0
                            ? Math.round((opt.voteCount / poll.totalVoters) * 100)
                            : 0;
                        const showResults = poll.hasVoted || !active;

                        return (
                            <div
                                key={opt.id}
                                className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${showResults ? styles.optionResult : ''} ${(!poll.hasVoted && active) ? styles.optionClickable : ''}`}
                                onClick={() => handleSelect(opt.id)}
                            >
                                <div className={styles.optionTop}>
                                    {!poll.hasVoted && active && (
                                        <span className={`${styles.optionControl} ${poll.type === 'single' ? styles.radio : styles.checkbox} ${isSelected ? styles.controlChecked : ''}`}/>
                                    )}
                                    <span className={styles.optionText}>{opt.text}</span>
                                    {showResults && (
                                        <span className={styles.optionPct}>{pct}%</span>
                                    )}
                                </div>
                                {showResults && (
                                    <div className={styles.progressBar}>
                                        <div
                                            className={styles.progressFill}
                                            style={{ width: `${pct}%`, opacity: opt.voteCount === maxVotes ? 1 : 0.5 }}
                                        />
                                    </div>
                                )}
                                {showResults && (
                                    <span className={styles.optionVotes}>{opt.voteCount} голосов</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Кнопка голосования */}
                {!poll.hasVoted && active && (
                    <div className={styles.voteArea}>
                        {error && <span className={styles.error}>{error}</span>}
                        <button
                            className={styles.voteBtn}
                            onClick={handleVote}
                            disabled={selected.length === 0 || voting}
                        >
                            {voting ? 'Отправка...' : 'Проголосовать'}
                        </button>
                    </div>
                )}

                {poll.hasVoted && (
                    <div className={styles.votedNotice}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Вы уже проголосовали
                    </div>
                )}

                {/* Список проголосовавших (для неанонимных) */}
                {!poll.isAnonymous && poll.votes && poll.votes.length > 0 && (
                    <div className={styles.votersList}>
                        <h3 className={styles.votersTitle}>Проголосовавшие</h3>
                        {poll.votes.map((vote, i) => (
                            <div key={i} className={styles.voterItem}>
                                <span className={styles.voterName}>
                                    {vote.user.name} {vote.user.surname}
                                </span>
                                <span className={styles.voterOption}>{vote.option.text}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Создание опроса ──────────────────────────────────────────────

function CreatePoll({ onBack, onCreated }: { onBack: () => void; onCreated: (poll: IPoll) => void }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'single' | 'multiple'>('single');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [options, setOptions] = useState([{ text: '', order: 1 }, { text: '', order: 2 }]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addOption = () => setOptions((prev) => [...prev, { text: '', order: prev.length + 1 }]);
    const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx + 1 })));
    const updateOption = (i: number, text: string) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, text } : o));

    const handleSubmit = async () => {
        setError(null);
        if (!title.trim()) return setError('Введите заголовок');
        if (!startsAt || !endsAt) return setError('Укажите даты');
        if (new Date(endsAt) <= new Date(startsAt)) return setError('Дата окончания должна быть позже начала');
        if (options.some((o) => !o.text.trim())) return setError('Заполните все варианты');
        if (options.length < 2) return setError('Минимум 2 варианта');

        setSubmitting(true);
        try {
            const res = await PollsService.createPoll({
                title, description: description || undefined,
                type, isAnonymous, startsAt, endsAt,
                options: options.filter((o) => o.text.trim()),
            });
            onCreated(res.data);
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Ошибка создания');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.detail}>
            <div className={styles.detailHeader}>
                <button className={styles.backBtn} onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Назад
                </button>
            </div>

            <div className={styles.detailContent}>
                <h1 className={styles.detailTitle}>Новый опрос</h1>

                <div className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label}>Заголовок</label>
                        <input className={styles.input} placeholder="Введите заголовок" value={title} onChange={(e) => setTitle(e.target.value)}/>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Описание (необязательно)</label>
                        <textarea className={`${styles.input} ${styles.textarea}`} placeholder="Описание опроса" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}/>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Тип</label>
                            <select className={styles.input} value={type} onChange={(e) => setType(e.target.value as 'single' | 'multiple')}>
                                <option value="single">Один ответ</option>
                                <option value="multiple">Несколько ответов</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Начало</label>
                            <input className={styles.input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}/>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Окончание</label>
                            <input className={styles.input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}/>
                        </div>
                    </div>

                    <div className={styles.toggleRow}>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}/>
                            <span className={styles.toggleSlider}/>
                            Анонимный опрос
                        </label>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Варианты ответов</label>
                        {options.map((opt, i) => (
                            <div key={i} className={styles.optionInput}>
                                <span className={styles.optionNum}>{i + 1}</span>
                                <input
                                    className={styles.input}
                                    placeholder={`Вариант ${i + 1}`}
                                    value={opt.text}
                                    onChange={(e) => updateOption(i, e.target.value)}
                                />
                                {options.length > 2 && (
                                    <button className={styles.removeOptionBtn} onClick={() => removeOption(i)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"/>
                                            <line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                        <button className={styles.addOptionBtn} onClick={addOption}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Добавить вариант
                        </button>
                    </div>

                    {error && <span className={styles.error}>{error}</span>}

                    <button className={styles.voteBtn} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Создание...' : 'Создать опрос'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Главная страница ─────────────────────────────────────────────

export default function PollsPage() {
    const { store } = useContext(Context);
    const isAdmin = store.user.role === 'admin';

    const [tab, setTab] = useState<Tab>('active');
    const [polls, setPolls] = useState<IPoll[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>('list');
    const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

    const loadPolls = (filter: Tab) => {
        setLoading(true);
        PollsService.getPolls(filter)
            .then((res) => setPolls(res.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadPolls(tab); }, [tab]);

    const handleTabChange = (t: Tab) => {
        setTab(t);
        setView('list');
        setSelectedPollId(null);
    };

    const handlePollClick = (id: string) => {
        setSelectedPollId(id);
        setView('detail');
    };

    const handleBack = () => {
        setView('list');
        setSelectedPollId(null);
        loadPolls(tab);
    };

    const handleCreated = () => {
        setView('list');
        loadPolls(tab);
    };

    return (
        <div className={styles.page}>
            {view === 'list' && (
                <>
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Опросы</h1>
                            <p className={styles.subtitle}>Участвуйте в опросах компании</p>
                        </div>
                        {isAdmin && (
                            <button className={styles.createBtn} onClick={() => setView('create')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Создать опрос
                            </button>
                        )}
                    </div>

                    <div className={styles.tabs}>
                        {(['active', 'finished', 'all'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                                onClick={() => handleTabChange(t)}
                            >
                                {t === 'active' ? 'Активные' : t === 'finished' ? 'Завершённые' : 'Все опросы'}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className={styles.grid}>
                            {[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton}/>)}
                        </div>
                    ) : polls.length === 0 ? (
                        <div className={styles.empty}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                <line x1="18" y1="20" x2="18" y2="10"/>
                                <line x1="12" y1="20" x2="12" y2="4"/>
                                <line x1="6" y1="20" x2="6" y2="14"/>
                            </svg>
                            <p>Опросов нет</p>
                        </div>
                    ) : (
                        <div className={styles.grid}>
                            {polls.map((poll) => (
                                <PollCard key={poll.id} poll={poll} onClick={() => handlePollClick(poll.id)}/>
                            ))}
                        </div>
                    )}
                </>
            )}

            {view === 'detail' && selectedPollId && (
                <PollDetail pollId={selectedPollId} onBack={handleBack} isAdmin={isAdmin}/>
            )}

            {view === 'create' && (
                <CreatePoll onBack={() => setView('list')} onCreated={handleCreated}/>
            )}
        </div>
    );
}
