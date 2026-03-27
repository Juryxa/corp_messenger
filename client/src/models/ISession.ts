export interface ISession {
    id: string;
    userAgent: string;
    ip: string;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
}

