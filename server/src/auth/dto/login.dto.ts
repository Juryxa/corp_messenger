import {
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsString,
	MaxLength,
	MinLength
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequest {
	@ApiProperty({
		description: 'ID сотрудника',
		example: 1337
	})
	@IsNumber()
	@IsNotEmpty()
	employee_Id: number;

	@ApiProperty({
		description: 'Почта',
		example: 'slavasamokat@gmail.com'
	})
	@IsEmail()
	@IsString()
	@IsNotEmpty()
	email: string;

	@ApiProperty({
		description: 'Пароль',
		example: 'qwerty12',
		maxLength: 128,
		minLength: 8
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(128, { message: 'Пароль не должен быть больше 128 символов' })
	@MinLength(8, { message: 'Пароль не должен быть меньше 8 символов' })
	password: string;
}
