// services/TasksService.ts
import type { AxiosResponse } from 'axios';
import $api from '../http';
import type { ITask } from '../models/task/ITask';

export interface CreateTaskRequest {
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    priority: string;
    status?: string;
}

export default class TasksService {
    static async getTasks(from?: string, to?: string): Promise<AxiosResponse<ITask[]>> {
        return $api.get('/tasks', { params: { from, to } });
    }

    static async createTask(dto: CreateTaskRequest): Promise<AxiosResponse<ITask>> {
        return $api.post('/tasks', dto);
    }

    static async updateTask(id: string, dto: CreateTaskRequest): Promise<AxiosResponse<ITask>> {
        return $api.put(`/tasks/${id}`, dto);
    }

    static async updateStatus(id: string, status: string): Promise<AxiosResponse<ITask>> {
        return $api.patch(`/tasks/${id}/status`, { status });
    }

    static async deleteTask(id: string): Promise<AxiosResponse<boolean>> {
        return $api.delete(`/tasks/${id}`);
    }
}
