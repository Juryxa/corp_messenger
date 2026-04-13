import {Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query,} from '@nestjs/common';
import {PollsService} from './polls.service';
import {CreatePollDto} from './dto/create-poll.dto';
import {VotePollDto} from './dto/vote-poll.dto';
import {ApiBearerAuth, ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {CurrentUser} from '../users/decorators/current-user.decorator';
import {AdminAuthorization, Authorization} from '../auth/decorators/authorization.decorator';

@ApiTags('Polls')
@ApiBearerAuth()
@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @ApiOperation({ summary: 'Получить список опросов' })
  @ApiQuery({ name: 'filter', enum: ['active', 'finished', 'all'], required: false })
  @Authorization()
  @Get()
  getPolls(
      @CurrentUser() user: { id: string },
      @Query('filter') filter: 'active' | 'finished' | 'all' = 'all',
  ) {
    return this.pollsService.getPolls(user.id, filter);
  }

  @ApiOperation({ summary: 'Получить опрос по id' })
  @Authorization()
  @Get(':id')
  getPoll(
      @Param('id') id: string,
      @CurrentUser() user: { id: string },
  ) {
    return this.pollsService.getPoll(id, user.id);
  }

  @ApiOperation({ summary: 'Создать опрос (только для администраторов)' })
  @AdminAuthorization()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPoll(
      @Body() dto: CreatePollDto,
      @CurrentUser() user: { id: string },
  ) {
    return this.pollsService.createPoll(user.id, dto);
  }

  @ApiOperation({ summary: 'Проголосовать' })
  @Authorization()
  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  vote(
      @Param('id') id: string,
      @Body() dto: VotePollDto,
      @CurrentUser() user: { id: string },
  ) {
    return this.pollsService.vote(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Удалить опрос' })
  @Authorization()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deletePoll(
      @Param('id') id: string,
      @CurrentUser() user: { id: string; role: string },
  ) {
    return this.pollsService.deletePoll(id, user.id, user.role);
  }
}