import {IsEnum} from 'class-validator';

export class UpdateTaskStatusDto {
    @IsEnum(['pending','inProgress','completed','cancelled'])
    status: string;
}