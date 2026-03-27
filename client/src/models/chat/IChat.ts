import type {IChatMember} from "./IChatMember";
import type {IMessage} from "./IMessage";

export type ChatType = 'direct' | 'group' | 'channel';

export interface IChat {
    id: string;
    type: ChatType;
    name?: string;
    members: IChatMember[];
    messages?: IMessage[];
}

