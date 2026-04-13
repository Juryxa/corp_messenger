import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {Context} from '../../main';
import {useCrypto} from '../crypto-hooks/useCrypto';
import {SOCKET_URL} from '../../http';
import type {IMessage} from '../../models/chat/IMessage';
import type {ITypingUser} from '../../models/chat/ITypingUser';

type SendMessagePayload = {
    chatId: string;
    encryptedText: string;
    encryptedKeySender?: string;
    encryptedKeyRecipient?: string;
    groupKeys?: { userId: string; encryptedKey: string }[];
    senderPublicKey: string;
};

export function useChat(chatId: string | null) {
    const { store } = useContext(Context);
    const { loadPrivateKeyFromSession, decryptMessageHybrid } = useCrypto();
    const socketRef = useRef<Socket | null>(null);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            if (message.sender.id === store.user.id) return; // свои уже добавлены с plaintext

            try {
                const privateKey = await loadPrivateKeyFromSession();
                if (!privateKey) {
                    message.text = '[Нет ключа]';
                    setMessages(prev => [...prev, message]);
                    return;
                }

                let encryptedKeyToUse: string;
                const senderPubForDecrypt = message.senderPublicKey;

                const isGroup = !!(message.groupKeys && message.groupKeys.length > 0);

                if (isGroup) {
                    const myKey = message.groupKeys!.find((k: any) => k.userId === store.user.id);
                    if (!myKey) throw new Error('Нет моего ключа в groupKeys');
                    encryptedKeyToUse = myKey.encryptedKey;
                } else {
                    // direct (чужое)
                    if (!message.encryptedKeyRecipient) throw new Error('Нет encryptedKeyRecipient');
                    encryptedKeyToUse = message.encryptedKeyRecipient;
                }

                message.text = await decryptMessageHybrid(
                    message.encryptedText,
                    encryptedKeyToUse,
                    privateKey,
                    false,                    // в группах и для чужих direct — всегда false
                    senderPubForDecrypt
                );
            } catch (e) {
                console.error('Ошибка расшифровки входящего сообщения:', e);
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

    // Сброс + загрузка истории из localStorage при смене чата
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

    // Подключение к комнате
    useEffect(() => {
        if (!chatId || !socketRef.current) return;
        socketRef.current.emit('joinChat', { chatId });
    }, [chatId]);

    // Сохранение истории
    useEffect(() => {
        if (!chatId || messages.length === 0) return;
        localStorage.setItem(`chat_history:${chatId}`, JSON.stringify(messages));
    }, [messages, chatId]);

    const sendSignalMessage = useCallback(
        (payload: SendMessagePayload) => {
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
        sendSignalMessage,
        handleTyping,
    };
}