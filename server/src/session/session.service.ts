import {Injectable} from "@nestjs/common";
import {PrismaService} from "../prisma/prisma.service";
import {SessionGateway} from "./session.gateway";

@Injectable()
export class SessionService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly sessionGateway: SessionGateway,
    ) {}

    async revokeSession(sessionId: string) {
        this.sessionGateway.revokeSession(sessionId);
    }

    async revokeAllUserSessions(userId: string) {
        this.sessionGateway.revokeAllUserSessions(userId);
    }
}