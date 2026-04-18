import {ApiBearerAuth, ApiTags} from "@nestjs/swagger";
import {Authorization} from "../auth/decorators/authorization.decorator";
import {Body, Controller, Post} from "@nestjs/common";
import {TotpService} from "./totp.service";
import {CurrentUser} from "../users/decorators/current-user.decorator";

@ApiTags('TOTP')
@ApiBearerAuth()
@Authorization()
@Controller('totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Post('setup')
  async setup(@CurrentUser() user: { id: string; email: string }) {
    return this.totpService.generateSetup(user.id, user.email);
  }

  @Post('confirm')
  async confirm(
      @CurrentUser() user: { id: string },
      @Body() dto: { code: string },
  ) {
    return this.totpService.confirmSetup(user.id, dto.code);
  }

  @Post('disable')
  async disable(
      @CurrentUser() user: { id: string },
      @Body() dto: { code: string },
  ) {
    return this.totpService.disable(user.id, dto.code);
  }
}