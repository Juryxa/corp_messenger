export interface UserMeResponse {
    id: string;
    name: string;
    surname: string;
    email: string;
    employee_Id: number;
    role: 'admin' | 'user';
    publicKey?: string | null;
}

