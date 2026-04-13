import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class PollOptionDto {
    @ApiProperty() @IsString() @IsNotEmpty() text: string;
    @ApiProperty() @IsNumber() order: number;
}

export class CreatePollDto {
    @ApiProperty() @IsString() @IsNotEmpty() title: string;
    @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
    @ApiProperty({enum: ['single', 'multiple']}) @IsEnum(['single', 'multiple']) type: 'single' | 'multiple';
    @ApiPropertyOptional() @IsBoolean() @IsOptional() isAnonymous?: boolean;
    @ApiProperty() @IsDateString() startsAt: string;
    @ApiProperty() @IsDateString() endsAt: string;
    @ApiProperty({type: [PollOptionDto]})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => PollOptionDto)
    options: PollOptionDto[];
}