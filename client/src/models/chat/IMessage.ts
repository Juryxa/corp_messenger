export interface IMessageGroupKey {
    id?: string;
    userId: string;
    encryptedKey: string;
    messageId?: string;
}

export interface IMessageRead {
    userId: string;
}

export interface IMessage {
    id: string;
    encryptedText: string;
    encryptedKeyRecipient?: string;
    encryptedKeySender?: string;
    senderPublicKey?: string;
    groupKeys?: IMessageGroupKey[];
    readBy?: IMessageRead[];
    text: string;
    chatId: string;
    createdAt: string;
    sender: {
        id: string;
        name: string;
        surname: string;
        employee_Id?: number;
    };
}