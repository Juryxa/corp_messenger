import {useContext, useEffect, useRef, useState} from 'react';
import {Context} from '../../main';
import {useChat} from '../../hooks/chat-hooks/useChat';
import {useCrypto} from '../../hooks/crypto-hooks/useCrypto';
import styles from './ChatsPage.module.css';
import ChatService from '../../services/ChatService';
import type {IChat} from '../../models/chat/IChat';
import type {IMessage} from '../../models/chat/IMessage';
import {CreateChatModal} from '../../components/CreateChatModal';
import {appendMessage} from '../../hooks/chat-hooks/useMessageCache';
import {useSearchParams} from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────

function getChatName(chat: IChat, currentUserId: string): string {
    if (chat.name) return chat.name;
    if (chat.type === 'direct') {
        const other = chat.members.find(m => m.userId !== currentUserId);
        return other ? `${other.user.name} ${other.user.surname}` : 'Чат';
    }
    return 'Без названия';
}

function getChatInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    }
    return date.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
}

function truncate(text: string, max = 20): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
}

function getChatTypeIcon(type: string) {
    if (type === 'group') return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
    );
    if (type === 'channel') return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
        </svg>
    );
    return null;
}

// ─── MessageBubble ────────────────────────────────────────────────

function MessageBubble({ message, isOwn }: {
    message: IMessage;
    isOwn: boolean;
    members?: { userId: string }[];
}) {
    // Считаем сколько человек прочитали (кроме отправителя)
    const readCount = isOwn
        ? (message.readBy?.filter(r => r.userId !== message.sender.id).length ?? 0)
        : 0;

    // Для direct: прочитано если есть хотя бы одна запись другого участника
    const isRead = readCount > 0;

    return (
        <div className={`${styles.messageWrap} ${isOwn ? styles.messageWrapOwn : ''}`}>
            {!isOwn && (
                <div className={styles.messageAvatar}>
                    {message.sender.name[0]}{message.sender.surname[0]}
                </div>
            )}
            <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : ''}`}>
                {!isOwn && (
                    <span className={styles.senderName}>
                        {message.sender.name} {message.sender.surname}
                    </span>
                )}
                <p className={styles.messageText}>{message.text}</p>
                <div className={styles.messageMeta}>
                    <span className={styles.messageTime}>{formatTime(message.createdAt)}</span>
                    {isOwn && (
                        <span className={`${styles.readStatus} ${isRead ? styles.readStatusRead : ''}`}>
                            {isRead ? (
                                // Двойная галочка — прочитано
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="2 12 8 18 16 6"/>
                                    <polyline points="9 12 15 18 23 6"/>
                                </svg>
                            ) : (
                                // Одинарная галочка — доставлено
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="5 12 10 17 20 7"/>
                                </svg>
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function ChatsPage() {
    const {store} = useContext(Context);
    const {importPublicKey, encryptMessageHybrid, encryptMessageForGroup,
        loadPrivateKeyFromSession} = useCrypto();

    const [searchParams] = useSearchParams();
    const queryChatId = searchParams.get('chat_id');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [chats, setChats] = useState<IChat[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [chatsLoading, setChatsLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [previews, setPreviews] = useState<Record<string, string>>({});

    // Черновики — Map chatId → text
    const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
    const [inputText, setInputText] = useState('');

    // Scroll state
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const inputRef = useRef<HTMLTextAreaElement>(null);

    const {
        messages, setMessages, typingUsers,
        hasMore, loadingMore, loadMoreMessages,
        unreadCounts, setUnreadCounts,
        sendSignalMessage, handleTyping, decryptPreviewMessage
    } = useChat(selectedChatId);

    const selectedChat = chats.find(c => c.id === selectedChatId) ?? null;
    const chatName = selectedChat ? getChatName(selectedChat, store.user.id) : '';
    const myMember = selectedChat?.members.find(m => m.userId === store.user.id);

    // ─── Query param чат ─────────────────────────────────────────

    useEffect(() => {
        if (queryChatId) setSelectedChatId(queryChatId);
    }, [queryChatId]);

    // ─── Загрузка чатов ──────────────────────────────────────────

    useEffect(() => {
        ChatService.getChats()
            .then(res => setChats(res.data))
            .finally(() => setChatsLoading(false));
    }, []);

    useEffect(() => {
        if (!chats.length) return;

        let cancelled = false;

        async function decryptPreviews() {
            const result: Record<string, string> = {};
            await Promise.all(
                chats.map(async chat => {
                    const msg = chat.messages?.[0];
                    if (!msg) return;
                    const text = await decryptPreviewMessage(msg);
                    result[chat.id] = text;
                })
            );
            if (!cancelled) setPreviews(result);
        }

        decryptPreviews();
        return () => { cancelled = true; };
    }, [chats, decryptPreviewMessage]);

    // ─── Черновики: сохраняем при смене чата ─────────────────────

    const prevChatIdRef = useRef<string | null>(null);

    useEffect(() => {
        const prevId = prevChatIdRef.current;

        // Сохраняем черновик предыдущего чата
        if (prevId && inputText.trim()) {
            setDrafts(prev => new Map(prev).set(prevId, inputText));
        } else if (prevId) {
            setDrafts(prev => {
                const m = new Map(prev);
                m.delete(prevId);
                return m;
            });
        }

        // Загружаем черновик нового чата
        setInputText(selectedChatId ? (drafts.get(selectedChatId) ?? '') : '');
        prevChatIdRef.current = selectedChatId;
    }, [selectedChatId]);

    // ─── Скролл ──────────────────────────────────────────────────

    // Автоскролл вниз при первой загрузке чата
    const prevChatForScroll = useRef<string | null>(null);
    useEffect(() => {
        if (selectedChatId !== prevChatForScroll.current) {
            prevChatForScroll.current = selectedChatId;
            setTimeout(() => scrollToBottom('auto'), 100);
        }
    }, [selectedChatId]);

    // Автоскролл при новом сообщении (только если были внизу)
    const prevMessagesLen = useRef(0);
    useEffect(() => {
        if (messages.length > prevMessagesLen.current && isAtBottom) {
            scrollToBottom('smooth');
        }
        prevMessagesLen.current = messages.length;
    }, [messages.length, isAtBottom]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({behavior});
        setShowScrollBtn(false);
    };

    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;

        const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = fromBottom < 80;
        setIsAtBottom(atBottom);
        setShowScrollBtn(!atBottom);

        // Infinite scroll вверх
        if (el.scrollTop < 100 && hasMore && !loadingMore) {
            const prevScrollHeight = el.scrollHeight;
            loadMoreMessages().then(() => {
                // Восстанавливаем позицию скролла после добавления сообщений сверху
                requestAnimationFrame(() => {
                    if (messagesContainerRef.current) {
                        messagesContainerRef.current.scrollTop =
                            messagesContainerRef.current.scrollHeight - prevScrollHeight;
                    }
                });
            });
        }
    };

    // ─── Отправка ─────────────────────────────────────────────────

    const handleSend = async () => {
        if (!inputText.trim() || !selectedChat || sending) return;

        setSending(true);
        const text = inputText.trim();
        setInputText('');

        // Сбрасываем черновик
        if (selectedChatId) {
            setDrafts(prev => {
                const m = new Map(prev);
                m.delete(selectedChatId);
                return m;
            });
        }

        try {
            const privateKey = await loadPrivateKeyFromSession();
            if (!privateKey) {setInputText(text); return;}

            const myPublicKeyBase64 = myMember?.user.publicKey;
            if (!myPublicKeyBase64) {setInputText(text); return;}

            let optimistic: IMessage;

            if (selectedChat.type === 'direct') {
                const recipient = selectedChat.members.find(m => m.userId !== store.user.id);
                const recipientPublicKey = recipient?.user.publicKey
                    ? await importPublicKey(recipient.user.publicKey) : null;

                const {encryptedText, encryptedKeyRecipient, encryptedKeySender, senderPublicKey} =
                    await encryptMessageHybrid(text, recipientPublicKey, privateKey, myPublicKeyBase64);

                sendSignalMessage({
                    chatId: selectedChat.id, encryptedText,
                    encryptedKeySender, encryptedKeyRecipient: encryptedKeyRecipient ?? undefined,
                    senderPublicKey,
                });

                optimistic = {
                    id: crypto.randomUUID(), encryptedText, encryptedKeySender,
                    senderPublicKey, text, chatId: selectedChat.id,
                    createdAt: new Date().toISOString(),
                    sender: {id: store.user.id, name: store.user.name, surname: store.user.surname, employee_Id: store.user.employee_Id},
                };
            } else {
                const memberKeys = await Promise.all(
                    selectedChat.members
                        .filter(m => m.user?.publicKey)
                        .map(async m => ({userId: m.userId, publicKey: await importPublicKey(m.user.publicKey!)}))
                );

                if (memberKeys.length === 0) {setInputText(text); return;}

                const {encryptedText, groupKeys, senderPublicKey} =
                    await encryptMessageForGroup(text, memberKeys, privateKey, myPublicKeyBase64);

                sendSignalMessage({chatId: selectedChat.id, encryptedText, groupKeys, senderPublicKey});

                optimistic = {
                    id: crypto.randomUUID(), encryptedText, groupKeys, senderPublicKey, text,
                    chatId: selectedChat.id, createdAt: new Date().toISOString(),
                    sender: {id: store.user.id, name: store.user.name, surname: store.user.surname, employee_Id: store.user.employee_Id},
                };
            }

            setMessages(prev => [...prev, optimistic]);
            await appendMessage(optimistic);

            // Прокручиваем вниз после отправки
            setTimeout(() => scrollToBottom('smooth'), 50);

        } catch (e) {
            console.error('Ошибка отправки:', e);
            setInputText(text);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputText(val);
        if (selectedChatId) {
            setDrafts(prev => new Map(prev).set(selectedChatId, val));
        }
        handleTyping();
    };

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId);
        // Сбрасываем счётчик непрочитанных
        setUnreadCounts(prev => ({...prev, [chatId]: 0}));
    };

    const handleChatCreated = async (chat: IChat) => {
        try {
            const res = await ChatService.getChat(chat.id);
            setChats(prev => [res.data, ...prev]);
            setSelectedChatId(res.data.id);
        } catch {
            const res = await ChatService.getChats();
            setChats(res.data);
            setSelectedChatId(chat.id);
        }
    };

    const canWrite = selectedChat?.type !== 'channel' ||
        myMember?.role === 'owner' || myMember?.role === 'admin';

    // Превью последнего сообщения для сайдбара
    const getPreview = (chat: IChat): string => {
        const lastMsg = chat.messages?.[0];
        if (!lastMsg) return '';

        const text = previews[chat.id] ?? '[...]';

        const prefix =
            lastMsg.sender.id === store.user.id
                ? 'Вы: '
                : `${lastMsg.sender.name}: `;

        return truncate(prefix + text, 20);
    };

    if (store.isLoading) return <div className={styles.loading}>Загрузка...</div>;

    return (
        <div className={styles.page}>
            {/* ─── Sidebar ──────────────────────────────────────── */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h2 className={styles.sidebarTitle}>Чаты</h2>
                    <button className={styles.newChatBtn} onClick={() => setShowCreateModal(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>

                {showCreateModal && (
                    <CreateChatModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={handleChatCreated}
                    />
                )}

                {chatsLoading ? (
                    <div className={styles.sidebarLoading}>
                        {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonItem}/>)}
                    </div>
                ) : chats.length === 0 ? (
                    <div className={styles.empty}>Нет чатов</div>
                ) : (
                    <ul className={styles.chatList}>
                        {chats.map(chat => {
                            const name = getChatName(chat, store.user.id);
                            const lastMsg = (chat.messages ?? [])[0];
                            const isActive = chat.id === selectedChatId;
                            const unread = unreadCounts[chat.id] ?? 0;
                            const preview = getPreview(chat);
                            const hasDraft = !isActive && drafts.has(chat.id);

                            return (
                                <li
                                    key={chat.id}
                                    className={`${styles.chatItem} ${isActive ? styles.chatItemActive : ''}`}
                                    onClick={() => handleSelectChat(chat.id)}
                                >
                                    <div className={`${styles.chatAvatar} ${styles[`avatar_${chat.type}`]}`}>
                                        {getChatTypeIcon(chat.type) ?? getChatInitials(name)}
                                    </div>
                                    <div className={styles.chatInfo}>
                                        <div className={styles.chatTop}>
                                            <span className={styles.chatName}>{name}</span>
                                            <span className={styles.chatTime}>
                                                {lastMsg && formatTime(lastMsg.createdAt)}
                                            </span>
                                        </div>
                                        <div className={styles.chatBottom}>
                                            <span className={`${styles.chatPreview} ${hasDraft ? styles.chatPreviewDraft : ''}`}>
                                                {hasDraft
                                                    ? `✏ ${truncate(drafts.get(chat.id)!, 24)}`
                                                    : preview}
                                            </span>
                                            {unread > 0 && (
                                                <span className={styles.unreadBadge}>
                                                    {unread > 99 ? '99+' : unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </aside>

            {/* ─── Dialog ───────────────────────────────────────── */}
            {selectedChat ? (
                <main className={styles.dialog}>
                    <div className={styles.dialogHeader}>
                        <div className={`${styles.chatAvatar} ${styles[`avatar_${selectedChat.type}`]} ${styles.headerAvatar}`}>
                            {getChatTypeIcon(selectedChat.type) ?? getChatInitials(chatName)}
                        </div>
                        <div className={styles.dialogHeaderInfo}>
                            <span className={styles.dialogName}>{chatName}</span>
                            <span className={styles.dialogMeta}>
                                {selectedChat.type === 'direct' ? 'Личный чат'
                                    : selectedChat.type === 'group' ? `${selectedChat.members.length} участников`
                                    : 'Канал'}
                            </span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        className={styles.messages}
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                    >
                        {/* Loader сверху */}
                        {loadingMore && (
                            <div className={styles.loadingMore}>
                                <div className={styles.loadingSpinner}/>
                            </div>
                        )}

                        {/* Кнопка "загрузить ещё" */}
                        {hasMore && !loadingMore && (
                            <button
                                className={styles.loadMoreBtn}
                                onClick={() => {
                                    const el = messagesContainerRef.current;
                                    const prevH = el?.scrollHeight ?? 0;
                                    loadMoreMessages().then(() => {
                                        requestAnimationFrame(() => {
                                            if (el) el.scrollTop = el.scrollHeight - prevH;
                                        });
                                    });
                                }}
                            >
                                Загрузить предыдущие сообщения
                            </button>
                        )}

                        {messages.length === 0 ? (
                            <div className={styles.noMessages}>
                                {selectedChat.type === 'direct'
                                    ? 'Начните общение'
                                    : 'Нет сообщений'}
                            </div>
                        ) : (
                            messages.map(msg => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.sender.id === store.user.id}
                                />
                            ))
                        )}

                        {typingUsers.length > 0 && (
                            <div className={styles.typing}>
                                <span className={styles.typingDots}>
                                    <span/><span/><span/>
                                </span>
                                печатает...
                            </div>
                        )}

                        <div ref={messagesEndRef}/>
                    </div>

                    {/* Кнопка "вниз" */}
                    {showScrollBtn && (
                        <button
                            className={styles.scrollToBottomBtn}
                            onClick={() => scrollToBottom('smooth')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                            {unreadCounts[selectedChatId ?? ''] > 0 && (
                                <span className={styles.scrollBadge}>
                                    {unreadCounts[selectedChatId ?? '']}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Input */}
                    {canWrite ? (
                        <div className={styles.inputArea}>
                            {drafts.has(selectedChatId ?? '') && (
                                <span className={styles.draftIndicator}>Черновик</span>
                            )}
                            <textarea
                                ref={inputRef}
                                className={styles.input}
                                placeholder={selectedChat.type === 'direct'
                                    ? 'Написать сообщение...'
                                    : 'Написать сообщение...'}
                                value={inputText}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={handleSend}
                                disabled={!inputText.trim() || sending}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13"/>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className={styles.channelNotice}>
                            Только администраторы канала могут писать сообщения
                        </div>
                    )}
                </main>
            ) : (
                <main className={styles.placeholder}>
                    <div className={styles.placeholderInner}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>Выберите чат чтобы начать общение</p>
                    </div>
                </main>
            )}
        </div>
    );
}
