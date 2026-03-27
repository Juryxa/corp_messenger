import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {Context} from "../../main";
import {useCrypto} from "../crypto-hooks/useCrypto";
import {SOCKET_URL} from "../../http";
import type {IMessage} from "../../models/chat/IMessage";
import type {ITypingUser} from "../../models/chat/ITypingUser";


export function useChat(chatId: string | null) {
    const { store } = useContext(Context);
    const socketRef = useRef<Socket | null>(null);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { loadPrivateKeyFromSession, decryptMessage } = useCrypto();

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
            console.log('Socket подключён, id:', socket.id);
            setConnected(true)}
        );
        socket.on('connect_error', (err) => {
            console.error('Socket ошибка подключения:', err); // ← добавь
        });
        socket.on('disconnect', () => setConnected(false));

        // Получаем новое сообщение — расшифровываем
        socket.on('newMessage', async (message: IMessage) => {
            // Своё сообщение уже добавлено оптимистично
            if (message.sender.id === store.user.id) return;

            try {
                const privateKey = await loadPrivateKeyFromSession();
                if (privateKey) {
                    message.text = await decryptMessage(message.text, privateKey);
                }
            } catch {
                message.text = '[Не удалось расшифровать]';
            }
            setMessages((prev) => [...prev, message]);
        });

        // Индикатор печати
        socket.on('userTyping', ({ userId, isTyping }: ITypingUser) => {
            setTypingUsers((prev) =>
                isTyping ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId),
            );
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [decryptMessage, loadPrivateKeyFromSession, store.user.id]);

    // При смене чата — подключаемся к комнате и загружаем историю
    useEffect(() => {
        if (!chatId || !socketRef.current) return;

        socketRef.current.emit('joinChat', { chatId });

        // Сбрасываем через колбэк чтобы не вызывать setState синхронно
        const resetState = () => {
            setMessages([]);
            setTypingUsers([]);
        };

        // Небольшой таймаут чтобы React не жаловался на синхронный setState в эффекте
        const timeout = setTimeout(resetState, 0);

        return () => clearTimeout(timeout);
    }, [chatId]);

    // Отправить сообщение
    const sendMessage = useCallback(
        async (encryptedForRecipient: string, encryptedForSelf: string) => {
            if (!socketRef.current || !chatId) return;
            socketRef.current.emit('sendMessage', {
                chatId,
                text: encryptedForRecipient,
                senderText: encryptedForSelf,
            });
        },
        [chatId],
    );

    // Индикатор печати
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
        sendMessage,
        handleTyping,
    };
}
