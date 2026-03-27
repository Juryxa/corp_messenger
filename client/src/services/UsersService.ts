import type {AxiosResponse} from "axios";
import $api, {API_USERS_SERVICE} from "../http";
import type {SaveKeysRequest} from "../models/request/SaveKeysRequest";
import type {PrivateKeyResponse} from "../models/response/PrivateKeyResponse";
import type {CryptoSaltResponse} from "../models/response/CryptoSaltResponse";
import type {PublicKeyResponse} from "../models/response/PublicKeyResponse";
import type {UserMeResponse} from "../models/response/UserMeResponse";
import type {UserSearchItem} from "../models/response/UserSearchItem";

export default class UsersService {
    static async getMe(): Promise<AxiosResponse<UserMeResponse>> {
        return $api.get<UserMeResponse>(API_USERS_SERVICE + '/me');
    }

    static async saveKeys(dto: SaveKeysRequest): Promise<AxiosResponse<{ id: string }>> {
        return $api.post<{ id: string }>(API_USERS_SERVICE + '/keys', dto);
    }

    static async getEncryptedPrivateKey(): Promise<AxiosResponse<PrivateKeyResponse>> {
        return $api.get<PrivateKeyResponse>(API_USERS_SERVICE + '/keys/private');
    }

    static async getCryptoSalt(): Promise<AxiosResponse<CryptoSaltResponse>> {
        return $api.get<CryptoSaltResponse>(API_USERS_SERVICE + '/keys/salt');
    }

    static async getPublicKey(userId: string): Promise<AxiosResponse<PublicKeyResponse>> {
        return $api.get<PublicKeyResponse>(`${API_USERS_SERVICE}/${userId}/public-key`);
    }

    static async searchUsers(query: string): Promise<AxiosResponse<UserSearchItem[]>> {
        return $api.get<UserSearchItem[]>(API_USERS_SERVICE + '/search', { params: { q: query } });
    }

    static async lookupUser(params: { email?: string; employee_Id?: number }): Promise<AxiosResponse<UserMeResponse>> {
        return $api.get<UserMeResponse>(API_USERS_SERVICE + '/lookup', { params });
    }

    static async getContacts(): Promise<AxiosResponse<UserSearchItem[]>> {
        return $api.get<UserSearchItem[]>(API_USERS_SERVICE + '/contacts');
    }

    static async setRole(userId: string, role: 'admin' | 'user'): Promise<AxiosResponse<UserMeResponse>> {
        return $api.patch<UserMeResponse>(`${API_USERS_SERVICE}/${userId}/role`, { role });
    }
}

