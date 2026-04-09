import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {Context} from '../../main';
import {useCrypto} from '../crypto-hooks/useCrypto';
import {SOCKET_URL} from '../../http';
import type {IMessage} from '../../models/chat/IMessage';
import type {ITypingUser} from '../../models/chat/ITypingUser';

export function useChat(chatId: string | null) {
    const { store } = useContext(Context);
    const { loadPrivateKeyFromSession, decryptMessageHybrid } = useCrypto();
    const socketRef = useRef<Socket | null>(null);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Подключаемся к WebSocket
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(`${SOCKET_URL}/chat`, {
            auth: { token },
            transports: ['websocket'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Chat socket подключён:', socket.id);
            setConnected(true);
        });

        socket.on('connect_error', (err) => {
            console.error('Chat socket ошибка:', err);
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('newMessage', async (message: IMessage) => {
            // Своё сообщение добавлено оптимистично
            if (message.sender.id === store.user.id) return;

            try {
                const privateKey = await loadPrivateKeyFromSession();
                if (privateKey && message.encryptedKeyRecipient) {
                    message.text = await decryptMessageHybrid(
                        message.encryptedText,
                        message.encryptedKeyRecipient,
                        privateKey,
                    );
                } else {
                    message.text = '[Нет ключа для расшифровки]';
                }
            } catch (e) {
                console.error('Ошибка расшифровки:', e);
                message.text = '[Не удалось расшифровать]';
            }

            setMessages((prev) => [...prev, message]);
        });

        socket.on('userTyping', ({ userId, isTyping }: ITypingUser) => {
            setTypingUsers((prev) =>
                isTyping
                    ? [...new Set([...prev, userId])]
                    : prev.filter((id) => id !== userId),
            );
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [store.user.id]);

    // Сброс при смене чата + загрузка истории из localStorage
    useEffect(() => {
        setTypingUsers([]);

        if (!chatId) {
            setMessages([]);
            return;
        }

        const stored = localStorage.getItem(`chat_history:${chatId}`);
        if (stored) {
            try {
                setMessages(JSON.parse(stored));
            } catch {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    }, [chatId]);

    // Подключение к комнате при смене чата
    useEffect(() => {
        if (!chatId || !socketRef.current) return;
        socketRef.current.emit('joinChat', { chatId });
    }, [chatId]);

    // Сохраняем историю при изменении сообщений
    useEffect(() => {
        if (!chatId || messages.length === 0) return;
        localStorage.setItem(`chat_history:${chatId}`, JSON.stringify(messages));
    }, [messages, chatId]);

    const sendSignalMessage = useCallback(
        (payload: {
            chatId: string;
            encryptedText: string;
            encryptedKeySender: string;
            encryptedKeyRecipient?: string;
        }) => {
            if (!socketRef.current) return;
            socketRef.current.emit('sendMessage', payload);
        },
        [],
    );

    const sendTyping = useCallback(
        (isTyping: boolean) => {
            if (!socketRef.current || !chatId) return;
            socketRef.current.emit('typing', { chatId, isTyping });
        },
        [chatId],
    );

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
        sendSignalMessage, // переименовано для ясности
        handleTyping,
    };
}