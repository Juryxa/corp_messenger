import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateTaskDto {
    @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) title: string;
    @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
    @ApiProperty() @IsDateString() startAt: string;
    @ApiProperty() @IsDateString() endAt: string;
    @ApiPropertyOptional({ enum: ['low','medium','high','urgent'] })
    @IsEnum(['low','medium','high','urgent']) @IsOptional() priority?: string;
    @ApiPropertyOptional({ enum: ['pending','inProgress','completed','cancelled'] })
    @IsEnum(['pending','inProgress','completed','cancelled']) @IsOptional() status?: string;
}