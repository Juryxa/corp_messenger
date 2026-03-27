export interface IMessageSender {
    id: string;
    name: string;
    surname: string;
    employee_Id?: number;
}

export interface IMessage {
    id: string;
    text: string;
    chatId?: string;
    createdAt: string;
    sender: IMessageSender;
}

