declare module 'express-serve-static-core' {
    interface User {
        id: string;
        role: 'admin' | 'user';
    }

    interface Request {
        user?: User;
    }
}

export {};