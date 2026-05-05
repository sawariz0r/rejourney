#!/usr/bin/env node
/**
 * export-convo.mjs
 *
 * Converts a Claude Code JSONL conversation file to readable Markdown
 * with sensitive values replaced by REDACTED placeholders.
 *
 * Usage:
 *   node scripts/export-convo.mjs <path-to-session.jsonl> [output.md]
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';

// ─── Redaction map ────────────────────────────────────────────────────────────
const REDACTIONS = [
    { pattern: /46\.224\.98\.62/g,          label: 'PROD_SERVER_IP' },
    { pattern: /~\/\.ssh\/vps_deploy/g,     label: '~/.ssh/[SSH_KEY]' },
    { pattern: /vps_deploy/g,               label: '[SSH_KEY]' },
    { pattern: /m\.rashid@utexas\.edu/g,    label: '[USER_EMAIL]' },
];

function redact(str) {
    for (const { pattern, label } of REDACTIONS) {
        str = str.replace(pattern, `[REDACTED:${label}]`);
    }
    return str;
}

// ─── Parse args ───────────────────────────────────────────────────────────────
const [,, inputPath, outputArg] = process.argv;
if (!inputPath) {
    console.error('Usage: node scripts/export-convo.mjs <session.jsonl> [output.md]');
    process.exit(1);
}
const sessionId = basename(inputPath, '.jsonl');
const outputPath = outputArg ?? resolve(`exported-convo-${sessionId}.md`);

// ─── Load + parse JSONL ───────────────────────────────────────────────────────
const entries = readFileSync(resolve(inputPath), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

// ─── Extract text from a content value ───────────────────────────────────────
function extractText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map(block => {
                if (typeof block === 'string') return block;
                // Skip thinking blocks for cleaner output
                if (block?.type === 'thinking') return '';
                if (block?.type === 'text') return block.text ?? '';
                if (block?.type === 'tool_use') {
                    const input = JSON.stringify(block.input ?? {}, null, 2);
                    return `\`[Tool: ${block.name}]\`\n\`\`\`json\n${input}\n\`\`\``;
                }
                if (block?.type === 'tool_result') {
                    const raw = Array.isArray(block.content)
                        ? block.content.map(c => c?.text ?? '').join('\n')
                        : String(block.content ?? '');
                    const trimmed = raw.slice(0, 6000);
                    const truncated = raw.length > 6000 ? '\n… (truncated)' : '';
                    return `\`[Tool result]\`\n\`\`\`\n${trimmed}${truncated}\n\`\`\``;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n\n');
    }
    return '';
}

// ─── Build message list ───────────────────────────────────────────────────────
// Each entry has entry.type = 'user' | 'assistant' and entry.message = {role, content}
const messages = [];
for (const entry of entries) {
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;

    // message field is sometimes a string (JSON-encoded dict), sometimes already an object
    let msg = entry.message;
    if (typeof msg === 'string') {
        try { msg = JSON.parse(msg); } catch { continue; }
    }
    if (!msg || typeof msg !== 'object') continue;

    const role = msg.role ?? entry.type;
    const text = extractText(msg.content ?? '').trim();
    if (!text) continue;

    // Skip sidechain / tool-internal messages if desired
    if (entry.isSidechain) continue;

    messages.push({ role, text, timestamp: entry.timestamp });
}

// ─── Sort by timestamp (they may be out of order in the file) ────────────────
messages.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

// ─── Render Markdown ──────────────────────────────────────────────────────────
const out = [
    `# Conversation Export`,
    ``,
    `**Session:** \`${sessionId}\`  `,
    `**Exported:** ${new Date().toISOString()}  `,
    `**Redacted:** PROD_SERVER_IP · SSH_KEY · USER_EMAIL`,
    ``,
    `---`,
    ``,
];

for (const { role, text } of messages) {
    const heading = role === 'user' ? '## 👤 User' : '## 🤖 Assistant';
    out.push(heading, '', redact(text), '', '---', '');
}

writeFileSync(outputPath, out.join('\n'), 'utf8');
console.log(`✅ Exported ${messages.length} messages → ${outputPath}`);
