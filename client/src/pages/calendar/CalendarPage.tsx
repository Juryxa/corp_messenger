import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import TasksService from '../../services/TasksService';
import type { ITask, TaskPriority, TaskStatus } from '../../models/task/ITask';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from '../../models/task/ITask';
import styles from './CalendarPage.module.css';

// ─── Date helpers ─────────────────────────────────────────────────

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const fmtDT = (d: Date) => d.toISOString().slice(0, 16);

function startOfWeek(d: Date): Date {
    const r = new Date(d);
    const day = r.getDay();
    r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
    r.setHours(0, 0, 0, 0);
    return r;
}

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function taskOverlapsDay(task: ITask, day: Date): boolean {
    const s = new Date(task.startAt);
    const e = new Date(task.endAt);
    const ds = new Date(day); ds.setHours(0, 0, 0, 0);
    const de = new Date(day); de.setHours(23, 59, 59, 999);
    return s <= de && e >= ds;
}

function taskOverlapsHour(task: ITask, day: Date, hour: number): boolean {
    const s = new Date(task.startAt);
    const e = new Date(task.endAt);
    const hs = new Date(day); hs.setHours(hour, 0, 0, 0);
    const he = new Date(day); he.setHours(hour, 59, 59, 999);
    return s <= he && e >= hs;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

type ViewMode = 'month' | 'week' | 'day';

// ─── Task form ────────────────────────────────────────────────────

interface TaskFormData {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    priority: TaskPriority;
    status: TaskStatus;
}

function TaskModal({ task, initialDate, onClose, onSaved }: {
    task?: ITask;
    initialDate?: string;
    onClose: () => void;
    onSaved: (t: ITask) => void;
}) {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TaskFormData>({
        defaultValues: task ? {
            title: task.title,
            description: task.description ?? '',
            startAt: fmtDT(new Date(task.startAt)),
            endAt: fmtDT(new Date(task.endAt)),
            priority: task.priority,
            status: task.status,
        } : {
            title: '',
            description: '',
            startAt: initialDate ?? fmtDT(new Date()),
            endAt: initialDate ?? fmtDT(new Date(Date.now() + 3600000)),
            priority: 'medium',
            status: 'pending',
        },
    });

    const onSubmit = async (data: TaskFormData) => {
        if (new Date(data.endAt) <= new Date(data.startAt)) {
            toast.error('Дата окончания должна быть позже начала');
            return;
        }
        try {
            const dto = { ...data, description: data.description || undefined };
            const res = task
                ? await TasksService.updateTask(task.id, dto)
                : await TasksService.createTask(dto);
            onSaved(res.data);
            toast.success(task ? 'Задача обновлена' : 'Задача создана');
            onClose();
        } catch (e: any) {
            toast.error(e.response?.data?.message ?? 'Ошибка сохранения');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{task ? 'Редактировать задачу' : 'Новая задача'}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    <div className={styles.field}>
                        <label className={styles.label}>Название *</label>
                        <input
                            className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                            placeholder="Введите название задачи"
                            {...register('title', { required: 'Обязательное поле', maxLength: { value: 100, message: 'Максимум 100 символов' } })}
                        />
                        {errors.title && <span className={styles.fieldError}>{errors.title.message}</span>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Описание</label>
                        <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            placeholder="Описание задачи..."
                            rows={3}
                            {...register('description')}
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Начало *</label>
                            <input
                                type="datetime-local"
                                className={`${styles.input} ${errors.startAt ? styles.inputError : ''}`}
                                {...register('startAt', { required: 'Укажите дату начала' })}
                            />
                            {errors.startAt && <span className={styles.fieldError}>{errors.startAt.message}</span>}
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Окончание *</label>
                            <input
                                type="datetime-local"
                                className={`${styles.input} ${errors.endAt ? styles.inputError : ''}`}
                                {...register('endAt', { required: 'Укажите дату окончания' })}
                            />
                            {errors.endAt && <span className={styles.fieldError}>{errors.endAt.message}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Приоритет</label>
                            <select className={styles.input} {...register('priority')}>
                                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Статус</label>
                            <select className={styles.input} {...register('status')}>
                                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                        {isSubmitting ? 'Сохранение...' : task ? 'Сохранить' : 'Создать задачу'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Task chip ────────────────────────────────────────────────────

function TaskChip({ task, onClick }: { task: ITask; onClick: (e: React.MouseEvent) => void }) {
    const color = PRIORITY_COLORS[task.priority];
    const done = task.status === 'completed' || task.status === 'cancelled';
    return (
        <div
            className={`${styles.chip} ${done ? styles.chipDone : ''}`}
            style={{ borderColor: color, background: `${color}18` }}
            onClick={onClick}
            title={task.title}
        >
            <span className={styles.chipDot} style={{ background: color }}/>
            <span className={styles.chipText}>{task.title}</span>
        </div>
    );
}

// ─── Context menu ─────────────────────────────────────────────────

function ContextMenu({ task, x, y, onClose, onEdit, onDelete, onStatusChange }: {
    task: ITask; x: number; y: number;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (s: TaskStatus) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className={styles.contextMenu}
            style={{ top: y, left: x }}
        >
            <div className={styles.contextTask}>
                <span className={styles.contextDot} style={{ background: PRIORITY_COLORS[task.priority] }}/>
                <span>{task.title}</span>
            </div>
            <div className={styles.contextDivider}/>
            <button className={styles.contextItem} onClick={onEdit}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Редактировать
            </button>
            <div className={styles.contextDivider}/>
            <div className={styles.contextLabel}>Статус</div>
            {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
                <button
                    key={v}
                    className={`${styles.contextItem} ${task.status === v ? styles.contextItemActive : ''}`}
                    onClick={() => { onStatusChange(v); onClose(); }}
                >
                    {l}
                </button>
            ))}
            <div className={styles.contextDivider}/>
            <button className={`${styles.contextItem} ${styles.contextDanger}`} onClick={onDelete}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                </svg>
                Удалить
            </button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────

export default function CalendarPage() {
    const [tasks, setTasks] = useState<ITask[]>([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<ViewMode>('month');
    const [current, setCurrent] = useState(new Date());
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<Set<TaskStatus>>(new Set(['pending', 'inProgress', 'completed', 'cancelled']));
    const [filterPriority, setFilterPriority] = useState<Set<TaskPriority>>(new Set(['low', 'medium', 'high', 'urgent']));
    const [modal, setModal] = useState<{ task?: ITask; initialDate?: string } | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ task: ITask; x: number; y: number } | null>(null);

    // ─── Load tasks ───────────────────────────────────────────────

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            let from: string, to: string;
            if (mode === 'month') {
                from = fmt(startOfMonth(current));
                to = fmt(addDays(new Date(current.getFullYear(), current.getMonth() + 1, 0), 1));
            } else if (mode === 'week') {
                from = fmt(startOfWeek(current));
                to = fmt(addDays(startOfWeek(current), 7));
            } else {
                from = fmt(current);
                to = fmt(addDays(current, 1));
            }
            const res = await TasksService.getTasks(from, to);
            setTasks(res.data);
        } catch {
            toast.error('Не удалось загрузить задачи');
        } finally {
            setLoading(false);
        }
    }, [mode, current]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // ─── Filtered tasks ───────────────────────────────────────────

    const filtered = useMemo(() =>
        tasks.filter(t =>
            filterStatus.has(t.status) &&
            filterPriority.has(t.priority) &&
            (!search || t.title.toLowerCase().includes(search.toLowerCase()) ||
                (t.description ?? '').toLowerCase().includes(search.toLowerCase()))
        ), [tasks, filterStatus, filterPriority, search]);

    // ─── Handlers ─────────────────────────────────────────────────

    const handleSaved = (t: ITask) => {
        setTasks(prev => {
            const idx = prev.findIndex(x => x.id === t.id);
            return idx >= 0 ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
        });
    };

    const handleDelete = async (task: ITask) => {
        setCtxMenu(null);
        try {
            await TasksService.deleteTask(task.id);
            setTasks(prev => prev.filter(t => t.id !== task.id));
            toast.success('Задача удалена');
        } catch {
            toast.error('Ошибка удаления');
        }
    };

    const handleStatusChange = async (task: ITask, status: TaskStatus) => {
        try {
            const res = await TasksService.updateStatus(task.id, status);
            setTasks(prev => prev.map(t => t.id === task.id ? res.data : t));
            toast.success(`Статус изменён: ${STATUS_LABELS[status]}`);
        } catch {
            toast.error('Ошибка изменения статуса');
        }
    };

    const openCtx = (e: React.MouseEvent, task: ITask) => {
        e.stopPropagation();
        setCtxMenu({ task, x: e.clientX, y: e.clientY });
    };

    const navigate = (dir: 1 | -1) => {
        if (mode === 'month') setCurrent(addMonths(current, dir));
        else if (mode === 'week') setCurrent(addDays(current, dir * 7));
        else setCurrent(addDays(current, dir));
    };

    const toggleFilter = <T extends string>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
        const next = new Set(set);
        next.has(val) ? next.delete(val) : next.add(val);
        setter(next as any);
    };

    // ─── Title ────────────────────────────────────────────────────

    const title = mode === 'month'
        ? `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`
        : mode === 'week'
            ? (() => { const s = startOfWeek(current); const e = addDays(s, 6); return `${s.getDate()} — ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`; })()
            : current.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    // ─── Render views ─────────────────────────────────────────────

    const renderMonth = () => {
        const firstDay = startOfMonth(current);
        const startDay = startOfWeek(firstDay);
        const cells: Date[] = [];
        for (let i = 0; i < 42; i++) cells.push(addDays(startDay, i));
        const today = new Date();

        return (
            <div className={styles.monthGrid}>
                {DAY_NAMES.map(d => <div key={d} className={styles.monthDayName}>{d}</div>)}
                {cells.map((day, i) => {
                    const dayTasks = filtered.filter(t => taskOverlapsDay(t, day));
                    const isCurrentMonth = day.getMonth() === current.getMonth();
                    const isToday = isSameDay(day, today);
                    const hasSearch = search && dayTasks.length > 0;
                    return (
                        <div
                            key={i}
                            className={`${styles.monthCell} ${!isCurrentMonth ? styles.monthCellOther : ''} ${isToday ? styles.monthCellToday : ''} ${hasSearch ? styles.monthCellHighlight : ''}`}
                            onDoubleClick={() => setModal({ initialDate: fmtDT(new Date(day.setHours(9, 0, 0, 0))) })}
                            onClick={() => { if (mode !== 'day') { setCurrent(new Date(day)); setMode('day'); } }}
                        >
                            <span className={styles.monthDate}>{day.getDate()}</span>
                            <div className={styles.monthTaskList}>
                                {dayTasks.slice(0, 3).map(t => (
                                    <TaskChip key={t.id} task={t} onClick={e => openCtx(e, t)}/>
                                ))}
                                {dayTasks.length > 3 && (
                                    <span className={styles.moreLabel}>+{dayTasks.length - 3} ещё</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderWeek = () => {
        const weekStart = startOfWeek(current);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const today = new Date();

        return (
            <div className={styles.weekGrid}>
                <div className={styles.weekHeader}>
                    <div className={styles.timeGutter}/>
                    {days.map((d, i) => (
                        <div key={i} className={`${styles.weekDayHeader} ${isSameDay(d, today) ? styles.todayHeader : ''}`}>
                            <span className={styles.weekDayName}>{DAY_NAMES[i]}</span>
                            <span className={styles.weekDayNum}>{d.getDate()}</span>
                        </div>
                    ))}
                </div>
                <div className={styles.weekBody}>
                    <div className={styles.hourLabels}>
                        {HOURS.map(h => (
                            <div key={h} className={styles.hourLabel}>{String(h).padStart(2, '0')}:00</div>
                        ))}
                    </div>
                    {days.map((day, di) => (
                        <div key={di} className={styles.weekDayCol}>
                            {HOURS.map(h => {
                                const hourTasks = filtered.filter(t => taskOverlapsHour(t, day, h));
                                return (
                                    <div
                                        key={h}
                                        className={styles.hourSlot}
                                        onDoubleClick={() => {
                                            const d = new Date(day);
                                            d.setHours(h, 0, 0, 0);
                                            setModal({ initialDate: fmtDT(d) });
                                        }}
                                    >
                                        {hourTasks.map(t => (
                                            <div
                                                key={t.id}
                                                className={`${styles.weekTask} ${t.status === 'completed' || t.status === 'cancelled' ? styles.weekTaskDone : ''}`}
                                                style={{ borderColor: PRIORITY_COLORS[t.priority], background: `${PRIORITY_COLORS[t.priority]}22` }}
                                                onClick={e => openCtx(e, t)}
                                            >
                                                {t.title}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderDay = () => {
        const dayTasks = filtered.filter(t => taskOverlapsDay(t, current));

        return (
            <div className={styles.dayView}>
                <div className={styles.weekBody}>
                    <div className={styles.hourLabels}>
                        {HOURS.map(h => <div key={h} className={styles.hourLabel}>{String(h).padStart(2, '0')}:00</div>)}
                    </div>
                    <div className={styles.dayCol}>
                        {HOURS.map(h => {
                            const hourTasks = dayTasks.filter(t => taskOverlapsHour(t, current, h));
                            return (
                                <div
                                    key={h}
                                    className={styles.hourSlot}
                                    onDoubleClick={() => {
                                        const d = new Date(current);
                                        d.setHours(h, 0, 0, 0);
                                        setModal({ initialDate: fmtDT(d) });
                                    }}
                                >
                                    {hourTasks.map(t => (
                                        <div
                                            key={t.id}
                                            className={`${styles.dayTask} ${t.status === 'completed' || t.status === 'cancelled' ? styles.weekTaskDone : ''}`}
                                            style={{ borderColor: PRIORITY_COLORS[t.priority], background: `${PRIORITY_COLORS[t.priority]}18` }}
                                            onClick={e => openCtx(e, t)}
                                        >
                                            <div className={styles.dayTaskTitle}>{t.title}</div>
                                            {t.description && <div className={styles.dayTaskDesc}>{t.description}</div>}
                                            <div className={styles.dayTaskMeta}>
                                                <span>{new Date(t.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — {new Date(t.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span style={{ color: PRIORITY_COLORS[t.priority] }}>{PRIORITY_LABELS[t.priority]}</span>
                                                <span>{STATUS_LABELS[t.status]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // ─── JSX ──────────────────────────────────────────────────────

    return (
        <div className={styles.page}>
            {/* Top bar */}
            <div className={styles.topBar}>
                <div className={styles.topLeft}>
                    <button className={styles.todayBtn} onClick={() => setCurrent(new Date())}>Сегодня</button>
                    <div className={styles.navBtns}>
                        <button className={styles.navBtn} onClick={() => navigate(-1)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button className={styles.navBtn} onClick={() => navigate(1)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                    <h2 className={styles.periodTitle}>{title}</h2>
                </div>
                <div className={styles.topRight}>
                    <input
                        className={styles.searchInput}
                        placeholder="Поиск задач..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className={styles.modeTabs}>
                        {(['month', 'week', 'day'] as ViewMode[]).map(m => (
                            <button key={m} className={`${styles.modeTab} ${mode === m ? styles.modeTabActive : ''}`} onClick={() => setMode(m)}>
                                {m === 'month' ? 'Месяц' : m === 'week' ? 'Неделя' : 'День'}
                            </button>
                        ))}
                    </div>
                    <button className={styles.createBtn} onClick={() => setModal({})}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Создать задачу
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                <span className={styles.filterLabel}>Статус:</span>
                {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
                    <label key={v} className={styles.filterChip}>
                        <input
                            type="checkbox"
                            checked={filterStatus.has(v)}
                            onChange={() => toggleFilter(filterStatus, v, setFilterStatus)}
                        />
                        <span>{l}</span>
                    </label>
                ))}
                <span className={styles.filterSep}/>
                <span className={styles.filterLabel}>Приоритет:</span>
                {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                    <label key={v} className={styles.filterChip}>
                        <input
                            type="checkbox"
                            checked={filterPriority.has(v)}
                            onChange={() => toggleFilter(filterPriority, v, setFilterPriority)}
                        />
                        <span style={{ color: PRIORITY_COLORS[v] }}>{l}</span>
                    </label>
                ))}
            </div>

            {/* Calendar body */}
            <div className={styles.calBody}>
                {loading ? (
                    <div className={styles.loadingCal}>Загрузка...</div>
                ) : (
                    <>
                        {mode === 'month' && renderMonth()}
                        {mode === 'week' && renderWeek()}
                        {mode === 'day' && renderDay()}
                    </>
                )}
            </div>

            {/* Modals */}
            {modal !== null && (
                <TaskModal
                    task={modal.task}
                    initialDate={modal.initialDate}
                    onClose={() => setModal(null)}
                    onSaved={handleSaved}
                />
            )}

            {ctxMenu && (
                <ContextMenu
                    task={ctxMenu.task}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    onClose={() => setCtxMenu(null)}
                    onEdit={() => { setModal({ task: ctxMenu.task }); setCtxMenu(null); }}
                    onDelete={() => handleDelete(ctxMenu.task)}
                    onStatusChange={s => handleStatusChange(ctxMenu.task, s)}
                />
            )}
        </div>
    );
}
