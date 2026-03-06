import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsString,
	MaxLength,
	MinLength
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';

export class RegisterRequest {
	@ApiProperty({
		description: 'Отображаемое имя',
		example: 'Вячеслав',
		maxLength: 80
	})
	@IsString({ message: 'Имя должно быть строкой' })
	@IsNotEmpty({ message: 'Имя не должно быть пустым' })
	@MaxLength(80, { message: 'Длина не должна быть больше 80 символов' })
	name: string;

	@ApiProperty({
		description: 'Отображаемая фамилия',
		example: 'Чернобаев',
		maxLength: 80
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(80)
	surname: string;

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

	@ApiProperty({
		description: 'Роль',
		example: Role.admin,
		enum: Role
	})
	@IsEnum(Role)
	@IsNotEmpty()
	role: Role;
}
