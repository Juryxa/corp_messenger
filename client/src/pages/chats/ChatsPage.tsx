import {useContext, useEffect, useRef, useState} from 'react';
import {Context} from '../../main';
import {useChat} from '../../hooks/chat-hooks/useChat';
import {useCrypto} from '../../hooks/crypto-hooks/useCrypto';
import styles from './ChatsPage.module.css';
import ChatService from "../../services/ChatService";
import type {IChat} from "../../models/chat/IChat";
import {CreateChatModal} from "../../components/CreateChatModal";
import type {IMessage} from "../../models/chat/IMessage";

// ─── Хелперы ─────────────────────────────────────────────────────

function getChatName(chat: IChat, currentUserId: string): string {
    if (chat.name) return chat.name;
    if (chat.type === 'direct') {
        const other = chat.members.find((m) => m.userId !== currentUserId);
        return other ? `${other.user.name} ${other.user.surname}` : 'Чат';
    }
    return 'Без названия';
}

function getChatInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    }
    return date.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
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
            <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
        </svg>
    );
    return null;
}

// ─── Компонент сообщения ─────────────────────────────────────────

function MessageBubble({message, isOwn}: {
    message: { id: string; text: string; createdAt: string; sender: { id: string; name: string; surname: string } };
    isOwn: boolean;
}) {
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
                <span className={styles.messageTime}>{formatTime(message.createdAt)}</span>
            </div>
        </div>
    );
}

// ─── Главный компонент ───────────────────────────────────────────

export default function ChatsPage() {
    const { store } = useContext(Context);
    const { importPublicKey, encryptMessageHybrid, loadPrivateKeyFromSession, decryptMessageHybrid } = useCrypto();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [chats, setChats] = useState<IChat[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [chatsLoading, setChatsLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { messages, setMessages, typingUsers, sendSignalMessage, handleTyping } = useChat(selectedChatId);

    const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;
    const chatName = selectedChat ? getChatName(selectedChat, store.user.id) : '';
    const myMember = selectedChat?.members.find((m) => m.userId === store.user.id);

    // Загрузка чатов
    useEffect(() => {
        ChatService.getChats()
            .then((res) => setChats(res.data))
            .finally(() => setChatsLoading(false));
    }, []);

    // Загружаем историю сообщений при выборе чата
    useEffect(() => {
        if (!selectedChatId) return;

        ChatService.getMessages(selectedChatId).then(async (res) => {
            const privateKey = await loadPrivateKeyFromSession();

            const decrypted = await Promise.all(
                res.data.messages.map(async (msg) => {
                    try {
                        if (privateKey) {
                            const isOwn = msg.sender.id === store.user.id;
                            // Своё сообщение расшифровываем своим ключом (encryptedKeySender)
                            // Чужое — ключом получателя (encryptedKeyRecipient)
                            const encryptedKey = isOwn
                                ? msg.encryptedKeySender
                                : msg.encryptedKeyRecipient;

                            if (encryptedKey) {
                                msg.text = await decryptMessageHybrid(
                                    msg.encryptedText,
                                    encryptedKey,
                                    privateKey,
                                );
                            } else {
                                msg.text = '[Нет ключа]';
                            }
                        }
                    } catch {
                        msg.text = '[Не удалось расшифровать]';
                    }
                    return msg;
                }),
            );
            setMessages(decrypted);
        });
    }, [selectedChatId]);

    // Скролл вниз при новых сообщениях
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Отправить сообщение
    const handleSend = async () => {
        if (!inputText.trim() || !selectedChat || sending) return;

        setSending(true);
        const text = inputText.trim();
        setInputText('');

        try {
            const myPublicKeyBase64 = myMember?.user.publicKey;
            if (!myPublicKeyBase64) {
                console.error('Нет публичного ключа отправителя');
                setInputText(text);
                return;
            }

            const senderPublicKey = await importPublicKey(myPublicKeyBase64);

            let recipientPublicKey: CryptoKey | null = null;
            if (selectedChat.type === 'direct') {
                const recipient = selectedChat.members.find((m) => m.userId !== store.user.id);
                if (recipient?.user.publicKey) {
                    recipientPublicKey = await importPublicKey(recipient.user.publicKey);
                }
            }

            const { encryptedText, encryptedKeyRecipient, encryptedKeySender } =
                await encryptMessageHybrid(text, recipientPublicKey, senderPublicKey);

            sendSignalMessage({
                chatId: selectedChat.id,
                encryptedText,
                encryptedKeySender,
                encryptedKeyRecipient: encryptedKeyRecipient ?? undefined,
            });

            const optimistic: IMessage = {
                id: crypto.randomUUID(),
                encryptedText,
                encryptedKeySender,
                text,
                chatId: selectedChat.id,
                createdAt: new Date().toISOString(),
                sender: {
                    id: store.user.id,
                    name: store.user.name,
                    surname: store.user.surname,
                    employee_Id: store.user.employee_Id,
                },
            };
            setMessages((prev) => [...prev, optimistic]);
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
        setInputText(e.target.value);
        handleTyping();
    };

    const handleChatCreated = (chat: IChat) => {
        setChats((prev) => [chat, ...prev]);
        setSelectedChatId(chat.id);
    };

    if (store.isLoading) return <div className={styles.loading}>Загрузка...</div>;

    return (
        <div className={styles.page}>
            {/* ─── Список чатов ────────────────────────────────── */}
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
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={styles.skeletonItem}/>
                        ))}
                    </div>
                ) : chats.length === 0 ? (
                    <div className={styles.empty}>Нет чатов</div>
                ) : (
                    <ul className={styles.chatList}>
                        {chats.map((chat) => {
                            const name = getChatName(chat, store.user.id);
                            const lastMsg = (chat.messages ?? [])[0];
                            const isActive = chat.id === selectedChatId;

                            return (
                                <li
                                    key={chat.id}
                                    className={`${styles.chatItem} ${isActive ? styles.chatItemActive : ''}`}
                                    onClick={() => setSelectedChatId(chat.id)}
                                >
                                    <div className={`${styles.chatAvatar} ${styles[`avatar_${chat.type}`]}`}>
                                        {getChatTypeIcon(chat.type) ?? getChatInitials(name)}
                                    </div>
                                    <div className={styles.chatInfo}>
                                        <div className={styles.chatTop}>
                                            <span className={styles.chatName}>{name}</span>
                                            {lastMsg && (
                                                <span className={styles.chatTime}>
                                                    {formatTime(lastMsg.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        {lastMsg && (
                                            <span className={styles.chatPreview}>
                                                {lastMsg.sender.name}: {lastMsg.text}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </aside>

            {/* ─── Диалог ──────────────────────────────────────── */}
            {selectedChat ? (
                <main className={styles.dialog}>
                    {/* Шапка */}
                    <div className={styles.dialogHeader}>
                        <div
                            className={`${styles.chatAvatar} ${styles[`avatar_${selectedChat.type}`]} ${styles.headerAvatar}`}>
                            {getChatTypeIcon(selectedChat.type) ?? getChatInitials(chatName)}
                        </div>
                        <div className={styles.dialogHeaderInfo}>
                            <span className={styles.dialogName}>{chatName}</span>
                            <span className={styles.dialogMeta}>
                                {selectedChat.type === 'direct' ? 'Личный чат' :
                                    selectedChat.type === 'group' ? `${selectedChat.members.length} участников` :
                                        'Канал'}
                            </span>
                        </div>
                    </div>

                    {/* Сообщения */}
                    <div className={styles.messages}>
                        {messages.length === 0 ? (
                            <div className={styles.noMessages}>Начните общение</div>
                        ) : (
                            messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.sender.id === store.user.id}
                                />
                            ))
                        )}

                        {/* Индикатор печати */}
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

                    {/* Поле ввода */}
                    {selectedChat.type !== 'channel' && (
                        <div className={styles.inputArea}>
                            <textarea
                                ref={inputRef}
                                className={styles.input}
                                placeholder="Написать сообщение..."
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
                    )}

                    {selectedChat.type === 'channel' && (

                        myMember?.role === 'owner' ? (
                            <div className={styles.inputArea}>
                                <textarea
                                    ref={inputRef}
                                    className={styles.input}
                                    placeholder="Написать сообщение..."
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
                        )
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
