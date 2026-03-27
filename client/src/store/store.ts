import type {IUser} from "../models/IUser";
import {makeAutoObservable} from "mobx";
import AuthService from "../services/AuthService";
import type {AxiosError, AxiosResponse} from 'axios';
import type {CreatedAccount} from "../models/response/RegisterResponse";

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
            this.setTemporaryPassword(response.data.isTemporaryPassword); // ← добавить
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
            await AuthService.logout();
            localStorage.removeItem('token');
            this.setAuth(false);
            this.setUser({} as IUser);
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
        } catch (e) {
            this.setAuth(false);
            const error = e as AxiosError<{ message: string }>;
            return error.response?.data?.message;
        } finally {
            this.setLoading(false);
        }
    }
}
