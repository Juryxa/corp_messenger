import {IsEnum, IsUUID} from 'class-validator';
import {CallType} from '../../generated/prisma/enums';

export class StartCallDto {
    @IsUUID()
    chatId: string;

    @IsEnum(CallType, { message: 'Некорректный тип звонка' })
    type: CallType;
}