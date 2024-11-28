
export type Page = {
    id: number;
    path: string;
    title: string;
    content: string;
    template: string;
    metadata: string;
    published_date: string;
}


export type Asset = {
    path: string;
    content: string;
    type: string;
}