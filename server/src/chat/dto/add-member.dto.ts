import {ApiProperty} from '@nestjs/swagger';
import {IsUUID} from 'class-validator';

export class AddMemberDto {
    @ApiProperty()
    @IsUUID()
    userId: string;
}