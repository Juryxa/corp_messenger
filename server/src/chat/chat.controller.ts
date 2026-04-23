import {Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query,} from '@nestjs/common';
import {ChatService} from './chat.service';
import {CreateChatDto} from './dto/create-chat.dto';
import {AddMemberDto} from './dto/add-member.dto';
import {MessagesQueryDto} from './dto/messages-query.dto';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import {CurrentUser} from "../users/decorators/current-user.decorator";
import {Authorization} from "../auth/decorators/authorization.decorator";

@ApiTags('Chat')
@Controller('chat')
@ApiBearerAuth()
@Authorization()
export class ChatController {
    constructor(private readonly chatService: ChatService) {
    }

    @ApiOperation({summary: 'Получить все чаты текущего юзера'})
    @Get()
    getChats(@CurrentUser() user: { id: string; role: string }) {
        return this.chatService.getChats(user.id);
    }

    @ApiOperation({summary: 'Количество непрочитанных сообщений'})
    @Authorization()
    @Get('unread')
    getUnreadCounts(@CurrentUser() user: { id: string }) {
        return this.chatService.getUnreadCounts(user.id);
    }

    @ApiOperation({summary: 'Получить чат по id'})
    @Get(':id')
    getChat(@Param('id') id: string, @CurrentUser() user: { id: string }) {
        return this.chatService.getChat(id, user.id);
    }

    @ApiOperation({summary: 'Создать чат'})
    @Post()
    @HttpCode(HttpStatus.CREATED)
    createChat(@Body() dto: CreateChatDto, @CurrentUser() user: { id: string }) {
        return this.chatService.createChat(user.id, dto);
    }


    @ApiOperation({summary: 'История сообщений'})
    @Get(':id/messages')
    getMessages(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Query() query: MessagesQueryDto,
    ) {
        return this.chatService.getMessages(id, user.id, query);
    }

    @ApiOperation({summary: 'Отметка о прочтении сообщений'})
    @Authorization()
    @Post(':id/read')
    @HttpCode(HttpStatus.NO_CONTENT)
    markAsRead(
        @Param('id') chatId: string,
        @CurrentUser() user: { id: string },
    ) {
        return this.chatService.markAsRead(chatId, user.id);
    }


    @ApiOperation({summary: 'Добавить участника'})
    @Post(':id/members')
    @HttpCode(HttpStatus.CREATED)
    addMember(
        @Param('id') id: string,
        @Body() dto: AddMemberDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.chatService.addMember(id, user.id, dto);
    }

    @ApiOperation({summary: 'Удалить участника'})
    @Delete(':id/members/:userId')
    @HttpCode(HttpStatus.OK)
    removeMember(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @CurrentUser() user: { id: string },
    ) {
        return this.chatService.removeMember(id, user.id, userId);
    }
}