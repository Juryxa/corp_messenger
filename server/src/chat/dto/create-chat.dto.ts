import {ChatType} from "../../generated/prisma/enums";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID} from "class-validator";


export class CreateChatDto{
    @ApiProperty({
        description: 'Создание чата: 1 на 1, группы или канала',
        example: ChatType.direct,
        enum: ChatType
    })
    @IsEnum(ChatType)
    @IsNotEmpty()
    type: ChatType;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsUUID(4)
    @IsOptional()
    targetUserId?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsUUID('4', { each: true })
    @IsOptional()
    memberIds?: string[];
}