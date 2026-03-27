import type {AxiosError} from 'axios';
import axios from 'axios';
import type {AuthResponse} from "../models/response/AuthResponse";


export const API_URL = `http://localhost:5000/api`
export const API_AUTH_SERVICE = `/auth`
export const API_CHAT_SERVICE = `/chat`
export const API_USERS_SERVICE = `/users`


const $api = axios.create({
    withCredentials: true,
    baseURL: API_URL
})

$api.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`
    return config;
})

$api.interceptors.response.use((config) => {
    return config;
}, async (error) => {
    const originalRequest = error.config;
    if (error.response.status == 401 && error.config && !error.config._isRetry) {
        originalRequest._isRetry = true;
        try {
            const response = await axios.post<AuthResponse>(
                `${API_URL}${API_AUTH_SERVICE}/refresh`,
                {},
                { withCredentials: true },
            );
            localStorage.setItem('token', response.data.accessToken);
            return $api.request(originalRequest);
        } catch (e) {
            const error = e as AxiosError<{ message: string }>;
            console.error(error.response?.data?.message)
        }
    }
    throw error;
})

export default $api;

