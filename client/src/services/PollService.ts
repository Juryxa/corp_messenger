import type { AxiosResponse } from 'axios';
import $api, {API_POLLS_SERVICE} from "../http";
import type { IPoll } from '../models/polls/IPoll';

export default class PollsService {
    static async getPolls(filter: 'active' | 'finished' | 'all' = 'all'): Promise<AxiosResponse<IPoll[]>> {
        return $api.get(`${API_POLLS_SERVICE}`, { params: { filter } });
    }

    static async getPoll(id: string): Promise<AxiosResponse<IPoll>> {
        return $api.get(`${API_POLLS_SERVICE}/${id}`);
    }

    static async createPoll(dto: {
        title: string;
        description?: string;
        type: 'single' | 'multiple';
        isAnonymous: boolean;
        startsAt: string;
        endsAt: string;
        options: { text: string; order: number }[];
    }): Promise<AxiosResponse<IPoll>> {
        return $api.post(API_POLLS_SERVICE, dto);
    }

    static async vote(pollId: string, optionIds: string[]): Promise<AxiosResponse<IPoll>> {
        return $api.post(`${API_POLLS_SERVICE}/${pollId}/vote`, { optionIds });
    }

    static async deletePoll(pollId: string): Promise<AxiosResponse<boolean>> {
        return $api.delete(`${API_POLLS_SERVICE}/${pollId}`);
    }
}