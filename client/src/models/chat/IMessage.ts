export interface IMessageSender {
    id: string;
    name: string;
    surname: string;
    employee_Id?: number;
}

export interface IMessage {
    id: string;
    encryptedText: string;
    encryptedKeyRecipient?: string;
    encryptedKeySender: string;
    createdAt: string;
    chatId: string;
    sender: IMessageSender;
    text: string;
}

