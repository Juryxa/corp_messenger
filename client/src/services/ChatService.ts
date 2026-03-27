import type {AxiosResponse} from "axios";
import $api, {API_CHAT_SERVICE} from "../http";
import type {IChat} from "../models/chat/IChat";
import type {IChatMember} from "../models/chat/IChatMember";
import type {ChatMessagesResponse} from "../models/response/ChatMessagesResponse";
import type {CreateChatRequest} from "../models/request/CreateChatRequest";
import type {AddChatMemberRequest} from "../models/request/AddChatMemberRequest";

export default class ChatService {
    static async getChats(): Promise<AxiosResponse<IChat[]>> {
        return $api.get<IChat[]>(API_CHAT_SERVICE);
    }

    static async getChat(chatId: string): Promise<AxiosResponse<IChat>> {
        return $api.get<IChat>(`${API_CHAT_SERVICE}/${chatId}`);
    }

    static async createChat(dto: CreateChatRequest): Promise<AxiosResponse<IChat>> {
        return $api.post<IChat>(API_CHAT_SERVICE, dto);
    }

    static async getMessages(chatId: string, params?: { skip?: number; take?: number }): Promise<AxiosResponse<ChatMessagesResponse>> {
        return $api.get<ChatMessagesResponse>(`${API_CHAT_SERVICE}/${chatId}/messages`, { params });
    }

    static async addMember(chatId: string, dto: AddChatMemberRequest): Promise<AxiosResponse<IChatMember>> {
        return $api.post<IChatMember>(`${API_CHAT_SERVICE}/${chatId}/members`, dto);
    }

    static async removeMember(chatId: string, userId: string): Promise<AxiosResponse<{ count: number }>> {
        return $api.delete<{ count: number }>(`${API_CHAT_SERVICE}/${chatId}/members/${userId}`);
    }
}

