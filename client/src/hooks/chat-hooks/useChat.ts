import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {Context} from '../../main';
import {useCrypto} from '../crypto-hooks/useCrypto';
import {SOCKET_URL} from '../../http';
import type {IMessage} from '../../models/chat/IMessage';
import type {ITypingUser} from '../../models/chat/ITypingUser';
import {appendMessage, cacheMessages, getCachedMessages} from './useMessageCache';
import ChatService from '../../services/ChatService';

type SendMessagePayload = {
    chatId: string;
    encryptedText: string;
    encryptedKeySender?: string;
    encryptedKeyRecipient?: string;
    groupKeys?: { userId: string; encryptedKey: string }[];
    senderPublicKey: string;
};

const TAKE = 50;

export function useChat(chatId: string | null) {
    const {store} = useContext(Context);
    const {loadPrivateKeyFromSession, decryptMessageHybrid} = useCrypto();
    const socketRef = useRef<Socket | null>(null);

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Расшифровка одного сообщения ────────────────────────────

    const decryptOne = useCallback(async (
        message: IMessage,
        privateKey: CryptoKey,  // ← принимаем снаружи
    ): Promise<IMessage> => {
        try {
            const isOwn = message.sender.id === store.user.id;
            const isGroup = !!(message.groupKeys && message.groupKeys.length > 0);

            if (isGroup) {
                const myKey = message.groupKeys!.find(k => k.userId === store.user.id);
                if (!myKey) return { ...message, text: '[Нет ключа]' };
                const text = await decryptMessageHybrid(
                    message.encryptedText, myKey.encryptedKey,
                    privateKey, false, message.senderPublicKey,
                );
                return { ...message, text };
            }

            if (isOwn) {
                if (!message.encryptedKeySender) return { ...message, text: '[Нет ключа]' };
                const text = await decryptMessageHybrid(
                    message.encryptedText, message.encryptedKeySender,
                    privateKey, true,
                );
                return { ...message, text };
            }

            if (!message.encryptedKeyRecipient) return { ...message, text: '[Нет ключа]' };
            const text = await decryptMessageHybrid(
                message.encryptedText, message.encryptedKeyRecipient,
                privateKey, false, message.senderPublicKey,
            );
            return { ...message, text };
        } catch {
            return { ...message, text: '[Не удалось расшифровать]' };
        }
    }, [store.user.id, decryptMessageHybrid]);

    const decryptPreviewMessage = useCallback(async (message: IMessage): Promise<string> => {
        try {
            const privateKey = await loadPrivateKeyFromSession();
            if (!privateKey) return '[Нет ключа]';
            const result = await decryptOne(message, privateKey);
            return result.text ?? '[Ошибка]';
        } catch {
            return '[Ошибка]';
        }
    }, [loadPrivateKeyFromSession, decryptOne]);
    // ─── WebSocket ────────────────────────────────────────────────

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(`${SOCKET_URL}/chat`, {
            auth: {token},
            transports: ['websocket'],
        });

        socketRef.current = socket;
        socket.on('connect', () => setConnected(true));
        socket.on('connect_error', err => console.error('Chat socket ошибка:', err));
        socket.on('disconnect', () => setConnected(false));

        socket.on('newMessage', async (message: IMessage) => {
            if (message.sender.id === store.user.id) return;

            const privateKey = await loadPrivateKeyFromSession();
            const decrypted = privateKey
                ? await decryptOne(message, privateKey)
                : { ...message, text: '[Нет ключа]' };

            await appendMessage(decrypted);

            setMessages(prev => {
                if (message.chatId === chatIdRef.current) {
                    // Дедупликация на случай если сообщение уже есть
                    if (prev.find(m => m.id === message.id)) return prev;
                    return [...prev, decrypted];
                }
                return prev;
            });

            if (message.chatId !== chatIdRef.current) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [message.chatId]: (prev[message.chatId] ?? 0) + 1,
                }));
            }
        });

        socket.on('messagesRead', ({ chatId, userId }: { chatId: string; userId: string }) => {
            if (chatId !== chatIdRef.current) return;

            // Обновляем readBy во всех сообщениях текущего чата
            setMessages(prev =>
                prev.map(msg => {
                    if (msg.sender.id === store.user.id && !msg.readBy?.find(r => r.userId === userId)) {
                        return {
                            ...msg,
                            readBy: [...(msg.readBy ?? []), { userId }],
                        };
                    }
                    return msg;
                })
            );
        });

        socket.on('userTyping', ({userId, isTyping}: ITypingUser) => {
            setTypingUsers(prev =>
                isTyping ? [...new Set([...prev, userId])] : prev.filter(id => id !== userId)
            );
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [store.user.id]);

    // Ref для chatId, чтобы использовать в замыканиях
    const chatIdRef = useRef<string | null>(null);
    useEffect(() => {
        chatIdRef.current = chatId;
    }, [chatId]);

    // ─── Загрузка непрочитанных при старте ───────────────────────

    useEffect(() => {
        ChatService.getUnreadCounts()
            .then(res => setUnreadCounts(res.data))
            .catch(() => {});
    }, []);

    // ─── Смена чата ───────────────────────────────────────────────

    useEffect(() => {
        setTypingUsers([]);
        setHasMore(false);

        if (!chatId) {
            setMessages([]);
            return;
        }

        // Флаг чтобы не перезаписывать если чат уже сменился
        let cancelled = false;

        const load = async () => {
            // 1. Сначала показываем кэш
            const cached = await getCachedMessages(chatId);
            if (cached.length > 0 && !cancelled) {
                setMessages(cached);
            }

            // 2. Загружаем приватный ключ один раз
            const privateKey = await loadPrivateKeyFromSession();
            if (!privateKey || cancelled) return;

            // 3. Грузим с сервера
            try {
                const res = await ChatService.getMessages(chatId, { skip: 0, take: TAKE });
                if (cancelled) return;

                const decrypted = await Promise.all(
                    res.data.messages.map((msg: IMessage) => decryptOne(msg, privateKey))
                );

                if (cancelled) return;

                // Кэшируем только расшифрованные (у которых есть text)
                const withText = decrypted.filter(m => m.text && !m.text.startsWith('['));
                if (withText.length > 0) await cacheMessages(withText);

                setMessages(decrypted);
                setHasMore(res.data.total > TAKE);
            } catch {
                // Используем кэш
            }

            // 4. Помечаем прочитанными
            socketRef.current?.emit('markRead', { chatId });
            setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
        };

        load();

        return () => { cancelled = true; };
    }, [chatId]);


    // ─── Подключение к комнате ────────────────────────────────────

    useEffect(() => {
        if (!chatId || !socketRef.current) return;
        socketRef.current.emit('joinChat', {chatId});
    }, [chatId]);

    // ─── Загрузка более ранних сообщений (infinite scroll up) ────

    const loadMoreMessages = useCallback(async () => {
        if (!chatId || loadingMore || !hasMore) return;
        setLoadingMore(true);

        try {
            const res = await ChatService.getMessages(chatId, {
                skip: messages.length,
                take: TAKE,
            });
// loadMoreMessages
            const privateKey = await loadPrivateKeyFromSession();
            if (!privateKey) return;

            const decrypted = await Promise.all(
                res.data.messages.map((msg: IMessage) => decryptOne(msg, privateKey))
            );

            await cacheMessages(decrypted);
            setMessages(prev => [...decrypted, ...prev]); // добавляем в начало
            setHasMore(res.data.total > messages.length + decrypted.length);
        } catch (e) {
            console.error('Ошибка загрузки истории:', e);
        } finally {
            setLoadingMore(false);
        }
    }, [chatId, messages.length, loadingMore, hasMore]);

    // ─── Отправка ─────────────────────────────────────────────────

    const sendSignalMessage = useCallback((payload: SendMessagePayload) => {
        if (!socketRef.current) return;
        socketRef.current.emit('sendMessage', payload);
    }, []);

    const sendTyping = useCallback((isTyping: boolean) => {
        if (!socketRef.current || !chatId) return;
        socketRef.current.emit('typing', {chatId, isTyping});
    }, [chatId]);

    const handleTyping = useCallback(() => {
        sendTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
    }, [sendTyping]);

    return {
        messages,
        setMessages,
        typingUsers,
        connected,
        hasMore,
        loadingMore,
        loadMoreMessages,
        unreadCounts,
        setUnreadCounts,
        sendSignalMessage,
        handleTyping,
        decryptOne,
        decryptPreviewMessage
    };
}
