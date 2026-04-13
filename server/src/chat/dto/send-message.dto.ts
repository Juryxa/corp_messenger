import {IsArray, IsOptional, IsString, IsUUID, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';

export class GroupKeyDto {
    @IsUUID() userId: string;
    @IsString() encryptedKey: string;
}

export class SendMessageDto {
    @IsUUID()
    chatId: string;

    @IsString()
    encryptedText: string;

    @IsString()
    @IsOptional()
    encryptedKeySender?: string;

    @IsString()
    @IsOptional()
    encryptedKeyRecipient?: string;

    @IsString()
    @IsOptional()
    senderPublicKey?: string; // ← добавляем

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => GroupKeyDto)
    groupKeys?: GroupKeyDto[];
}