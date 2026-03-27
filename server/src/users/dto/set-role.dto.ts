import {ApiProperty} from "@nestjs/swagger";
import {IsEnum} from "class-validator";

export class SetRoleDto {
    @ApiProperty({ enum: ['admin', 'user'] })
    @IsEnum(['admin', 'user'])
    role: 'admin' | 'user';
}

