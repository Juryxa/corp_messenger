export interface IPollOption {
    id: string;
    text: string;
    order: number;
    voteCount: number;
}

export interface IPollVote {
    user: { id: string; name: string; surname: string };
    option: { id: string; text: string };
}

export interface IPoll {
    id: string;
    title: string;
    description?: string;
    type: 'single' | 'multiple';
    isAnonymous: boolean;
    startsAt: string;
    endsAt: string;
    createdAt: string;
    creator: { id: string; name: string; surname: string };
    options: IPollOption[];
    votes?: IPollVote[];
    totalVoters: number;
    hasVoted: boolean;
}