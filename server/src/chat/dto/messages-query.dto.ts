import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsInt, IsOptional, Max, Min} from 'class-validator';
import {Type} from 'class-transformer';

export class MessagesQueryDto {
    @ApiPropertyOptional({ default: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    skip?: number = 0;

    @ApiPropertyOptional({ default: 30 })
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    take?: number = 30;
}