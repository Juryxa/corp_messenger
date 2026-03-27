import {Body, Controller, Get, Param, Patch, Post, Query, UseGuards} from '@nestjs/common';
import {UsersService} from './users.service';
import {SaveKeysDto} from './dto/save-keys.dto';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import {JwtAuthGuard} from '../auth/guards/auth.guard';
import {CurrentUser} from './decorators/current-user.decorator';
import {AdminAuthorization, Authorization} from "../auth/decorators/authorization.decorator";
import {SetRoleDto} from "./dto/set-role.dto";

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Получить своего профиль' })
  @Authorization()
  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.getUser(user.id);
  }

  @ApiOperation({ summary: 'Сохранить ключи шифрования' })
  @Authorization()
  @Post('keys')
  saveKeys(
      @CurrentUser() user: { id: string },
      @Body() dto: SaveKeysDto,
  ) {
    return this.usersService.saveKeys(user.id, dto);
  }

  @ApiOperation({ summary: 'Получить свой зашифрованный приватный ключ' })
  @Authorization()
  @Get('keys/private')
  getPrivateKey(@CurrentUser() user: { id: string }) {
    return this.usersService.getEncryptedPrivateKey(user.id);
  }
  @Authorization()
  @Get('keys/salt')
  getSalt(@CurrentUser() user: { id: string }) {
    return this.usersService.getCryptoSalt(user.id);
  }

  @ApiOperation({ summary: 'Получить публичный ключ пользователя' })
  @Authorization()
  @Get(':id/public-key')
  getPublicKey(@Param('id') id: string) {
    return this.usersService.getPublicKey(id);
  }

  @ApiOperation({ summary: 'Поиск пользователей' })
  @Authorization()
  @Get('search')
  searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query ?? '');
  }

  @ApiOperation({ summary: 'Найти пользователя по email или employee_Id' })
  @Authorization()
  @Get('lookup')
  lookupUser(
      @Query('email') email?: string,
      @Query('employee_Id') employeeId?: string,
  ) {
    const parsedEmployeeId = employeeId ? Number(employeeId) : undefined;
    return this.usersService.lookupUser({
      email: email?.trim() || undefined,
      employeeId: typeof parsedEmployeeId === 'number' && !Number.isNaN(parsedEmployeeId)
          ? parsedEmployeeId
          : undefined,
    });
  }

  @ApiOperation({ summary: 'Изменить роль пользователя (admin/user)' })
  @AdminAuthorization()
  @Patch(':id/role')
  setRole(
      @Param('id') id: string,
      @Body() dto: SetRoleDto,
  ) {
    return this.usersService.setRole(id, dto.role);
  }
}