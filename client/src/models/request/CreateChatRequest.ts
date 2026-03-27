import type {ChatType} from "../chat/IChat";

export interface CreateChatRequest {
    type: ChatType;
    name?: string;
    description?: string;
    targetUserId?: string;
    memberIds?: string[];
}

