import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsCodeBlock } from "~/shared/docs/DocsCodeBlock";
import { createMarkdownHeadingIdGenerator } from "~/shared/lib/markdownHeadings";

export function EngineeringMarkdownContent({ content }: { content: string }) {
    const getHeadingId = createMarkdownHeadingIdGenerator();

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                pre: ({ children }) => <>{children}</>,
                code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const language = match ? match[1] : "";
                    const rawCode = String(children).replace(/\n$/, "");
                    const trimmedCode = rawCode.trim();
                    const isBlock = !inline && (language || rawCode.includes("\n"));

                    if (isBlock && trimmedCode) {
                        const isTerminal = ["bash", "sh", "zsh", "term"].includes(language);
                        return (
                            <div className="my-8 overflow-hidden rounded-md border-2 border-slate-950 bg-slate-950 shadow-[5px_5px_0_0_rgba(0,0,0,1)]">
                                {isTerminal && (
                                    <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-4 py-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                                        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                                    </div>
                                )}
                                <DocsCodeBlock code={trimmedCode} language={language} isTerminal={isTerminal} />
                            </div>
                        );
                    }

                    return (
                        <code className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-950" {...props}>
                            {children}
                        </code>
                    );
                },
                h2: ({ children }) => {
                    const text = String(children);
                    return (
                        <h2 id={getHeadingId(text)} className="scroll-mt-28 border-t-4 border-slate-950 pt-8 text-3xl font-black uppercase leading-tight tracking-normal text-slate-950 sm:text-4xl">
                            {children}
                        </h2>
                    );
                },
                h3: ({ children }) => {
                    const text = String(children);
                    return (
                        <h3 id={getHeadingId(text)} className="scroll-mt-28 text-2xl font-black leading-tight tracking-normal text-slate-950">
                            {children}
                        </h3>
                    );
                },
                h4: ({ children }) => (
                    <h4 className="text-lg font-black uppercase tracking-wide text-slate-950">
                        {children}
                    </h4>
                ),
                p: ({ children }) => (
                    <p className="text-lg leading-8 text-slate-700">
                        {children}
                    </p>
                ),
                ul: ({ children }) => (
                    <ul className="ml-6 list-outside list-disc space-y-3 text-lg leading-8 text-slate-700">
                        {children}
                    </ul>
                ),
                ol: ({ children }) => (
                    <ol className="ml-6 list-outside list-decimal space-y-3 text-lg leading-8 text-slate-700">
                        {children}
                    </ol>
                ),
                li: ({ children }) => <li className="pl-1">{children}</li>,
                a: ({ href, children }) => (
                    <a
                        href={href}
                        className="font-bold text-slate-950 underline decoration-2 underline-offset-4 transition hover:bg-slate-950 hover:text-white"
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                        {children}
                    </a>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="my-8 border-l-4 border-slate-950 bg-slate-50 py-4 pl-5 pr-5 text-slate-700">
                        {children}
                    </blockquote>
                ),
                img: ({ src, alt }) => {
                    if (!src) return null;
                    return (
                        <figure className="my-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm">
                            <img src={src} alt={alt ?? ""} className="h-auto w-full object-cover" loading="lazy" />
                            {alt && <figcaption className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-500">{alt}</figcaption>}
                        </figure>
                    );
                },
                table: ({ children }) => (
                    <div className="my-10 overflow-x-auto rounded-md border border-slate-200 shadow-sm">
                        <table className="min-w-full border-collapse bg-white text-left text-sm">
                            {children}
                        </table>
                    </div>
                ),
                thead: ({ children }) => (
                    <thead className="border-b border-slate-950 bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-950">
                        {children}
                    </thead>
                ),
                th: ({ children }) => <th className="px-4 py-3 align-top">{children}</th>,
                td: ({ children }) => <td className="border-t border-slate-200 px-4 py-3 align-top text-slate-700">{children}</td>,
                hr: () => <hr className="my-12 border-t-2 border-slate-950" />,
                strong: ({ children }) => <strong className="font-black text-slate-950">{children}</strong>,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
