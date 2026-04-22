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
    isAwaitingTotp = false;
    tempToken: string | null = null;
    requireTotpSetup = false;
    needsKeyRestore = false;
    password = '';

    setNeedsKeyRestore(bool: boolean) {
        this.needsKeyRestore = bool;
    }

    setPasswordTemp(password: string) {
        this.password = password;
    }

    getPasswordTemp() {
        return this.password;
    }

    markKeysAsLoaded() {
        this.needsKeyRestore = false;
    }

    setAwaitingTotp(bool: boolean) {
        this.isAwaitingTotp = bool;
    }

    setTempToken(token: string | null) {
        this.tempToken = token;
    }

    setRequireTotpSetup(bool: boolean) {
        this.requireTotpSetup = bool;
    }


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
            if (response.data.requireTotp && response.data.tempToken) {
                this.setTempToken(response.data.tempToken);
                this.setAwaitingTotp(true);
                return;
            }
            localStorage.setItem('token', response.data.accessToken!);
            this.setAuth(true);
            this.setUser(response.data.user!);
            this.setTemporaryPassword(response.data.isTemporaryPassword ?? false);
            this.setAwaitingTotp(false);
            this.setTempToken(null);
            this.reconnectSessionSocket();
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message;
        }
    }

    async submitTotp(code: string) {
        try {
            const response = await AuthService.loginTotp(this.tempToken!, code);

            if (!response.data.accessToken) {
                throw new Error('Не получен accessToken');
            }

            localStorage.setItem('token', response.data.accessToken);
            this.setAwaitingTotp(false);
            this.setTempToken(null);
            this.setAuth(true);
            this.setUser(response.data.user!);
            this.setTemporaryPassword(response.data.isTemporaryPassword ?? false);
            this.markKeysAsLoaded();

            // Небольшая задержка, чтобы MobX и Router успели отреагировать
            setTimeout(() => {
                this.reconnectSessionSocket();
            }, 50);

            return undefined;
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message || 'Неверный код 2FA';
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
            this.password = '';
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
            if (response.data.accessToken !== undefined && response.data.user !== undefined) {
                localStorage.setItem('token', response.data.accessToken);
                this.setAuth(true);
                this.setUser(response.data.user);
                // Если TOTP включён но ключа нет в session — это нормально, RestoreKeyPage справится
                // Но если пользователь вошёл через refresh — TOTP уже был пройден ранее, всё ок
                this.reconnectSessionSocket();
            }
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
