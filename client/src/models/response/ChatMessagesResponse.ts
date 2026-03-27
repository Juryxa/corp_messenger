import type {IMessage} from "../chat/IMessage";

export interface ChatMessagesResponse {
    messages: IMessage[];
    total: number;
    skip: number;
    take: number;
}

