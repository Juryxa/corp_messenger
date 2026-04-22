import axios, {type AxiosResponse} from 'axios';
import $api, {API_AUTH_SERVICE, API_URL} from "../http";
import type {AuthResponse} from "../models/response/AuthResponse";
import type {CreatedAccount} from "../models/response/RegisterResponse";
import type {ChangePasswordRequest} from "../models/request/ChangePasswordRequest";
import type {ISession} from "../models/ISession";

export default class AuthService {
    static async login(password: string, email?: string, employeeId?: number): Promise<AxiosResponse<AuthResponse>> {
        return $api.post<AuthResponse>(API_AUTH_SERVICE+'/login', {
            ...(email ? { email } : { employee_Id: employeeId }),
            password,
        });
    }

    static async registration(name: string, surname: string, role: 'admin'|'user', email: string, employeeId: number, password: string): Promise<AxiosResponse<CreatedAccount>> {
        return $api.post<CreatedAccount>(API_AUTH_SERVICE+'/register', {name, surname, role, email, employee_Id: employeeId, password})
    }

    static async refresh(): Promise<AxiosResponse<AuthResponse>> {
        return axios.post<AuthResponse>(`${API_URL}${API_AUTH_SERVICE}/refresh`, {}, { withCredentials: true });
    }

    static async logout(): Promise<void> {
        return $api.post(API_AUTH_SERVICE+'/logout')
    }

    static async changePassword(dto: ChangePasswordRequest): Promise<AxiosResponse<AuthResponse>> {
        return $api.post<AuthResponse>(API_AUTH_SERVICE + '/change-password', dto);
    }

    static async getSessions(): Promise<AxiosResponse<ISession[]>> {
        return $api.get<ISession[]>(API_AUTH_SERVICE + '/sessions');
    }

    static async deleteSession(sessionId: string): Promise<AxiosResponse<boolean>> {
        return $api.delete<boolean>(`${API_AUTH_SERVICE}/sessions/${sessionId}`);
    }

    static async deleteAllOtherSessions(): Promise<AxiosResponse<boolean>> {
        return $api.delete<boolean>(API_AUTH_SERVICE + '/sessions');
    }

    static async deleteAllSessionsByUser(userId: string): Promise<AxiosResponse<boolean>> {
        return $api.delete<boolean>(`${API_AUTH_SERVICE}/sessions/user/${userId}`);
    }
    static async loginTotp(tempToken: string, code: string): Promise<AxiosResponse<AuthResponse>> {
        return axios.post(`${API_URL}${API_AUTH_SERVICE}/login/totp`, { tempToken, code }, { withCredentials: true });
    }

    static async setupTotp(): Promise<AxiosResponse<{ secret: string; qrCodeDataUrl: string }>> {
        return $api.post('/totp/setup');
    }

    static async confirmTotp(code: string): Promise<AxiosResponse<boolean>> {
        return $api.post('/totp/confirm', { code });
    }
}

