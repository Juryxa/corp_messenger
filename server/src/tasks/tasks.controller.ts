import {Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query} from '@nestjs/common';
import {TasksService} from './tasks.service';
import {CreateTaskDto} from './dto/create-task.dto';
import {UpdateTaskStatusDto} from './dto/update-task.dto';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import {CurrentUser} from '../users/decorators/current-user.decorator';
import {Authorization} from "../auth/decorators/authorization.decorator";

@ApiTags('Tasks')
@ApiBearerAuth()
@Authorization()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({summary: 'Получить задачи'})
  @Get()
  getTasks(
      @CurrentUser() user: { id: string },
      @Query('from') from?: string,
      @Query('to') to?: string,
  ) {
    return this.tasksService.getTasks(user.id, from, to);
  }

  @ApiOperation({ summary: 'Создать задачу' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: { id: string }) {
    return this.tasksService.createTask(user.id, dto);
  }

  @ApiOperation({ summary: 'Обновить задачу' })
  @Put(':id')
  updateTask(
      @Param('id') id: string,
      @Body() dto: CreateTaskDto,
      @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.updateTask(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Обновить статус задачи' })
  @Patch(':id/status')
  updateStatus(
      @Param('id') id: string,
      @Body() dto: UpdateTaskStatusDto,
      @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.updateStatus(id, user.id, dto.status);
  }

  @ApiOperation({ summary: 'Удалить задачу' })
  @Delete(':id')
  deleteTask(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tasksService.deleteTask(id, user.id);
  }
}