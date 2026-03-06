export interface JwtPayload {
	id: string;
	role: 'admin' | 'user';
}
