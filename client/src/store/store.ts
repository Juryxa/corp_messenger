import type {IUser} from "../models/IUser";
import {makeAutoObservable} from "mobx";
import AuthService from "../services/AuthService";
import type {AxiosError, AxiosResponse} from 'axios';
import type {CreatedAccount} from "../models/response/RegisterResponse";
import {jwtDecode} from 'jwt-decode';
import {connectSessionSocket, disconnectSessionSocket} from "../websocket/sessionSocket";

interface JwtPayload {
    id: string;
    role: 'admin' | 'user';
    sessionId: string;
}

export default class Store {
    user = {} as IUser;
    isAuth = false;
    isLoading = true;
    isTemporaryPassword = false;


    constructor() {
        makeAutoObservable(this);
    }

    setAuth(bool: boolean) {
        this.isAuth = bool;
    }

    setTemporaryPassword(bool: boolean) {
        this.isTemporaryPassword = bool;
    }

    setUser(user: IUser) {
        this.user = user;
    }

    setLoading(bool: boolean) {
        this.isLoading = bool;
    }

    async login(password: string, email?: string, employeeId?: number) {
        try {
            const response = await AuthService.login(password, email, employeeId);
            localStorage.setItem('token', response.data.accessToken);
            this.setAuth(true);
            this.setUser(response.data.user);
            this.setTemporaryPassword(response.data.isTemporaryPassword);
            this.reconnectSessionSocket();
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message;
        }
    }

    async registration(
        name: string,
        surname: string,
        role: 'admin' | 'user',
        email: string,
        employeeId: number,
        password: string
    ): Promise<AxiosResponse<CreatedAccount>> {
        try {
            return await AuthService.registration(
                name,
                surname,
                role,
                email,
                employeeId,
                password
            );
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            throw error;
        }
    }

    async logout() {
        try {
            // Читаем актуальный sessionId прямо сейчас из текущего токена
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const decoded = jwtDecode<JwtPayload>(token);
                    if (decoded.sessionId) {
                        await AuthService.deleteSession(decoded.sessionId);
                    }
                } catch {
                    // игнорируем ошибку декодирования
                }
            }
            localStorage.clear();
            sessionStorage.clear();
            await AuthService.logout();
            this.setAuth(false);
            this.setUser({} as IUser);
            disconnectSessionSocket();
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message;
        }
    }

    async checkAuth() {
        this.setLoading(true);
        try {
            const response = await AuthService.refresh();
            localStorage.setItem('token', response.data.accessToken);
            this.setAuth(true);
            this.setUser(response.data.user);
            this.reconnectSessionSocket();
        } catch (e) {
            this.setAuth(false);
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message;
        } finally {
            this.setLoading(false);
        }
    }

    reconnectSessionSocket() {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = connectSessionSocket(token);

        socket.on('SESSION_REVOKED', () => {
            console.warn('Сессия отозвана');

            disconnectSessionSocket();

            localStorage.removeItem('token');
            this.setAuth(false);
            this.setUser({} as IUser);

            window.location.href = '/login';
        });
    }
}
