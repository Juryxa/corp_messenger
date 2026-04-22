import type {IUser} from "../IUser";

export interface AuthResponse {
    accessToken?: string;
    isTemporaryPassword?: boolean;
    user?: IUser;
    requireTotp?: boolean;
    tempToken?: string;
    requireTotpSetup?: boolean;   // ← добавь
}
