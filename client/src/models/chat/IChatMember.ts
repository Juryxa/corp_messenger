export type ChatMemberRole = 'owner' | 'admin' | 'member';

export interface IChatMemberUser {
    id: string;
    name: string;
    surname: string;
    employee_Id?: number;
    publicKey?: string;
}

export interface IChatMember {
    userId: string;
    role: ChatMemberRole;
    user: IChatMemberUser;
}

