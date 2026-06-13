import type { LeakCodePointer } from '~/shared/api/client';

export type LeakIde = 'cursor' | 'claude' | 'codex' | 'vscode';
export type LeakIdeHandoffMode = 'copy' | 'open';

export type LeakIdeConfig = {
    handoffMode?: LeakIdeHandoffMode;
    ide: LeakIde;
    localRepoPath: string;
};

export type LeakIdeHandoff = {
    markdown: string;
    pointer?: LeakCodePointer | null;
    title?: string;
};

export const LEAK_IDE_OPTIONS: Record<LeakIde, {
    actionLabel: string;
    clipboardFallback: string;
    label: string;
    supportsPromptPrefill: boolean;
}> = {
    cursor: {
        actionLabel: 'Open Cursor',
        clipboardFallback: 'Markdown copied. Paste it into Cursor Agent after the repo opens.',
        label: 'Cursor',
        supportsPromptPrefill: false,
    },
    claude: {
        actionLabel: 'Open Claude',
        clipboardFallback: 'Markdown copied and Claude Code opened with the handoff prefilled.',
        label: 'Claude Code',
        supportsPromptPrefill: true,
    },
    codex: {
        actionLabel: 'Open Codex',
        clipboardFallback: 'Markdown copied and Codex opened with the handoff prefilled.',
        label: 'Codex',
        supportsPromptPrefill: true,
    },
    vscode: {
        actionLabel: 'Open VS Code',
        clipboardFallback: 'Markdown copied. Paste it into your VS Code coding agent after the repo opens.',
        label: 'VS Code',
        supportsPromptPrefill: false,
    },
};

const MAX_DEEP_LINK_PROMPT_CHARS = 13_500;

function trimSlashes(value: string): string {
    return value.replace(/[\\/]+$/, '').replace(/^[\\/]+/, '');
}

function normalizeLocalPath(path: string): string {
    return path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
}

function joinLocalPath(root: string, relativeFile: string): string {
    const normalizedRoot = normalizeLocalPath(root);
    const normalizedFile = trimSlashes(relativeFile.trim().replace(/\\/g, '/'));
    return `${normalizedRoot}/${normalizedFile}`;
}

function encodeLocalPath(path: string): string {
    return encodeURI(normalizeLocalPath(path));
}

function appendQueryParams(url: string, params: Record<string, string | undefined>): string {
    const query = Object.entries(params)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    return query ? `${url}?${query}` : url;
}

function buildPrompt(markdown: string, title?: string): string {
    const prefix = title
        ? `Use this Rejourney issue-detection markdown context to investigate and fix "${title}".\n\n`
        : 'Use this Rejourney issue-detection markdown context to investigate and fix the issue.\n\n';
    const prompt = `${prefix}${markdown}`;

    if (prompt.length <= MAX_DEEP_LINK_PROMPT_CHARS) return prompt;

    return `${prompt.slice(0, MAX_DEEP_LINK_PROMPT_CHARS)}\n\n[Rejourney truncated this deep-link prompt. The full markdown handoff was copied to your clipboard.]`;
}

export function buildLeakIdeUrl(config: LeakIdeConfig, pointer?: LeakCodePointer | null): string | null {
    if (!config.localRepoPath.trim()) return null;

    const targetPath = pointer?.file
        ? joinLocalPath(config.localRepoPath, pointer.file)
        : config.localRepoPath.trim();
    const line = pointer?.line && pointer.line > 0 ? pointer.line : 1;
    const column = pointer?.column && pointer.column > 0 ? pointer.column : 1;
    const encodedPath = encodeLocalPath(targetPath);

    if (config.ide === 'cursor') {
        return `cursor://file/${encodedPath}:${line}:${column}`;
    }

    if (config.ide !== 'vscode') return buildLeakIdeWorkspaceUrl(config);

    return `vscode://file/${encodedPath}:${line}:${column}`;
}

export function buildLeakIdeWorkspaceUrl(config: LeakIdeConfig): string | null {
    if (!config.localRepoPath.trim()) return null;

    const localRepoPath = normalizeLocalPath(config.localRepoPath);
    const encodedPath = encodeLocalPath(localRepoPath);

    if (config.ide === 'cursor') {
        return `cursor://file/${encodedPath}`;
    }

    if (config.ide === 'claude') {
        return appendQueryParams('claude://code/new', { folder: localRepoPath });
    }

    if (config.ide === 'codex') {
        return appendQueryParams('codex://new', { path: localRepoPath });
    }

    return `vscode://file/${encodedPath}`;
}

export function buildLeakIdeHandoffUrl(config: LeakIdeConfig, handoff: LeakIdeHandoff): string | null {
    if (!config.localRepoPath.trim()) return null;

    const localRepoPath = normalizeLocalPath(config.localRepoPath);
    const prompt = buildPrompt(handoff.markdown, handoff.title);

    if (config.ide === 'claude') {
        return appendQueryParams('claude://code/new', {
            folder: localRepoPath,
            q: prompt,
        });
    }

    if (config.ide === 'codex') {
        return appendQueryParams('codex://new', {
            path: localRepoPath,
            prompt,
        });
    }

    return buildLeakIdeUrl({ ...config, localRepoPath }, handoff.pointer);
}
