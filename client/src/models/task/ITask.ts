// models/task/ITask.ts
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'inProgress' | 'completed' | 'cancelled';

export interface ITask {
    id: string;
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: string;
    userId: string;
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
    low: '#5a6480',
    medium: '#4f8ef7',
    high: '#f97316',
    urgent: '#e05c6a',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочный',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
    pending: 'Ожидает',
    inProgress: 'В процессе',
    completed: 'Завершено',
    cancelled: 'Отменено',
};
