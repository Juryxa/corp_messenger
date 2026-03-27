import type {IUser} from "../IUser";

export interface AuthResponse {
    accessToken: string;
    isTemporaryPassword: boolean;
    user: IUser;
}
