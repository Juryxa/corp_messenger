import {ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse} from "@nestjs/swagger";
import {Authorization} from "../auth/decorators/authorization.decorator";
import {Body, Controller, Post} from "@nestjs/common";
import {TotpService} from "./totp.service";
import {CurrentUser} from "../users/decorators/current-user.decorator";
import {TotpCodeDto} from "./dto/totp-code.dto";

@ApiTags('TOTP — Двухфакторная аутентификация')
@ApiBearerAuth()
@Authorization()
@Controller('totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @ApiOperation({
    summary: 'Инициализация настройки TOTP',
    description: 'Генерирует секретный ключ и QR-код для сканирования в Google Authenticator. Вызывается автоматически после первой смены пароля.',
  })
  @ApiOkResponse({
    description: 'QR-код и секретный ключ для ручного ввода',
    schema: {
      example: {
        qrCodeDataUrl: 'data:image/png;base64,...',
        secret: 'JBSWY3DPEHPK3PXP',
      },
    },
  })
  @Post('setup')
  async setup(@CurrentUser() user: { id: string; email: string }) {
    return this.totpService.generateSetup(user.id, user.email);
  }

  @ApiOperation({
    summary: 'Подтверждение настройки TOTP',
    description: 'Проверяет первый код из приложения и включает двухфакторную аутентификацию. После этого при каждом входе будет требоваться код.',
  })
  @ApiOkResponse({ description: 'TOTP успешно настроен, возвращает true' })
  @ApiUnauthorizedResponse({ description: 'Неверный код — возможно приложение не синхронизировано' })
  @Post('confirm')
  async confirm(
      @CurrentUser() user: { id: string },
      @Body() dto: TotpCodeDto,
  ) {
    return this.totpService.confirmSetup(user.id, dto.code);
  }
}