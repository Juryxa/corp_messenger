import type {IChatMember} from "./IChatMember";
import type {IMessage} from "./IMessage";

export type ChatType = 'direct' | 'group' | 'channel';

export interface IChat {
    id: string;
    type: 'direct' | 'group' | 'channel';
    name?: string;
    description?: string;
    createdAt: string;
    members: IChatMember[];
    messages?: IMessage[]; // ← IMessage уже содержит groupKeys, encryptedKeySender и т.д.
}

