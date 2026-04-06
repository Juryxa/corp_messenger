import {io, Socket} from "socket.io-client";
import {SOCKET_URL} from "../http";

let socket: Socket | null = null;

export const connectSessionSocket = (token: string) => {
    // 🔥 если уже есть соединение — убиваем
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    socket = io(`${SOCKET_URL}/session`, {
        auth: { token },
        withCredentials: true,
        transports: ['websocket'],
        autoConnect: true,
    });

    return socket;
};

export const disconnectSessionSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const getSessionSocket = () => socket;