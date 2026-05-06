import type { ReactNode } from "react";

export interface Article {
    id: string;
    title: string;
    subtitle: string;
    /** Comma-separated phrases for legacy meta keywords - helps match long-tail searches to article topics */
    seoKeywords?: string;
    seo: {
        primaryKeyword: string;
        metaTitle: string;
        metaDescription: string;
        targetKeywords: string[];
        topicTags: string[];
    };
    author: {
        name: string;
        url: string; // LinkedIn
        github?: string;
    };
    image: string;
    date: string;
    urlDate: string;
    dateModified?: string;
    readTime: string;
    schema: object;
    content: ReactNode;
}
