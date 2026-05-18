import type { ArticleTableOfContentsItem } from "~/shared/data/engineeringTypes";

export function generateMarkdownHeadingId(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function createMarkdownHeadingIdGenerator(): (text: string) => string {
    const seenIds = new Map<string, number>();

    return (text: string) => {
        const baseId = generateMarkdownHeadingId(text) || "section";
        const seenCount = seenIds.get(baseId) ?? 0;
        seenIds.set(baseId, seenCount + 1);
        return seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;
    };
}

export function extractMarkdownTableOfContents(markdown: string): ArticleTableOfContentsItem[] {
    const items: ArticleTableOfContentsItem[] = [];
    const getHeadingId = createMarkdownHeadingIdGenerator();
    let insideCodeFence = false;

    for (const line of markdown.split(/\r?\n/)) {
        if (/^\s*```/.test(line)) {
            insideCodeFence = !insideCodeFence;
            continue;
        }

        if (insideCodeFence) {
            continue;
        }

        const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!match) {
            continue;
        }

        const title = match[2]
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/[`*_~]/g, "")
            .trim();

        if (!title) {
            continue;
        }

        items.push({
            id: getHeadingId(title),
            title,
            level: match[1].length as 2 | 3,
        });
    }

    return items;
}

export function markdownToPlainText(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/[*_~|>#-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
