import {applyDecorators, UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../guards/auth.guard';
import {AdminGuard} from "../guards/admin.guard";

export function Authorization() {
	return applyDecorators(UseGuards(JwtAuthGuard));
}

export function AdminAuthorization() {
	return applyDecorators(UseGuards(JwtAuthGuard, AdminGuard));
}
