export interface IUser {
    email: string;
    id: string;
    employee_Id: number;
    password: string;
    name: string;
    surname: string;
    role: 'admin'|'user';
}
