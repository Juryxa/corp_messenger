import {type IDBPDatabase, openDB} from 'idb';
import type {IMessage} from '../../models/chat/IMessage';

const DB_NAME = 'messenger_cache';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';
const MAX_MESSAGES_PER_CHAT = 200; // храним последние 200 на чат

let db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
    if (db) return db;
    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
                const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
                store.createIndex('chatId', 'chatId');
                store.createIndex('createdAt', 'createdAt');
            }
        },
    });
    return db;
}

export async function getCachedMessages(chatId: string): Promise<IMessage[]> {
    const database = await getDb();
    const tx = database.transaction(MESSAGES_STORE, 'readonly');
    const index = tx.store.index('chatId');
    const messages = await index.getAll(chatId);
    return messages.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export async function cacheMessages(messages: IMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const database = await getDb();
    const tx = database.transaction(MESSAGES_STORE, 'readwrite');
    for (const msg of messages) {
        await tx.store.put(msg);
    }
    await tx.done;

    // Чистим старые сообщения если превысили лимит
    const chatId = messages[0].chatId;
    await trimChatMessages(chatId);
}

export async function appendMessage(message: IMessage): Promise<void> {
    const database = await getDb();
    await database.put(MESSAGES_STORE, message);
    await trimChatMessages(message.chatId);
}

async function trimChatMessages(chatId: string): Promise<void> {
    const database = await getDb();
    const tx = database.transaction(MESSAGES_STORE, 'readwrite');
    const index = tx.store.index('chatId');
    const all = await index.getAll(chatId);

    all.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (all.length > MAX_MESSAGES_PER_CHAT) {
        const toDelete = all.slice(0, all.length - MAX_MESSAGES_PER_CHAT);
        for (const key of toDelete) {
            await tx.store.delete(key);
        }
    }
    await tx.done;
}

export async function clearChatCache(chatId: string): Promise<void> {
    const database = await getDb();
    const tx = database.transaction(MESSAGES_STORE, 'readwrite');
    const index = tx.store.index('chatId');
    const keys = await index.getAllKeys(chatId);
    for (const key of keys) await tx.store.delete(key);
    await tx.done;
}

export async function clearAllCache(): Promise<void> {
    const database = await getDb();
    await database.clear(MESSAGES_STORE);
}