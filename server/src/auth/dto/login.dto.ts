import {IsEmail, IsNotEmpty, IsNumber, IsString, MaxLength, MinLength, ValidateIf} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';

export class LoginRequest {
	@ApiPropertyOptional({ description: 'ID сотрудника', example: 1337 })
    @IsNumber()
    @ValidateIf((o) => o.email == null)
    employee_Id: number;

    @ApiPropertyOptional({description: 'Почта', example: 'slavasamokat@gmail.com'})
    @IsEmail()
    @IsString()
    @ValidateIf((o) => o.employee_Id == null)
    email: string;

    @ApiProperty({
        description: 'Пароль',
        example: 'qwerty12',
        maxLength: 128,
        minLength: 8
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, {message: 'Пароль не должен быть больше 128 символов'})
    @MinLength(8, {message: 'Пароль не должен быть меньше 8 символов'})
    password: string;
}
