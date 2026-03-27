import {IsNotEmpty, IsString, IsUUID} from 'class-validator';

export class SendMessageDto {
    @IsUUID()
    @IsNotEmpty()
    chatId: string;

    @IsString()
    @IsNotEmpty()
    text: string;
}