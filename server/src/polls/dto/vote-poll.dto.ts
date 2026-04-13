import {ApiProperty} from '@nestjs/swagger';
import {IsArray, IsUUID} from 'class-validator';

export class VotePollDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @IsUUID('4', { each: true })
    optionIds: string[];
}