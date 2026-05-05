/**
 * Project Created Success Modal
 *
 * Shows after successful project creation with project key and AI prompt copy actions.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, KeyRound, Sparkles, X } from 'lucide-react';
import { AI_INTEGRATION_PROMPT } from '~/shared/constants/aiPrompts';
import { Project } from '~/shared/types';
import { Button } from './Button';
import { Modal } from './Modal';

interface ProjectCreatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

function getProjectPlatformLabel(project: Project): string {
  if (project.platforms.length === 0) return 'No platform selected';
  if (project.platforms.length === 2) return 'iOS and Android';

  return project.platforms[0] === 'ios' ? 'iOS app' : 'Android app';
}

export const ProjectCreatedModal: React.FC<ProjectCreatedModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const promptText = useMemo(() => {
    if (!project?.publicKey) return AI_INTEGRATION_PROMPT;
    return AI_INTEGRATION_PROMPT.replace('PUBLIC_KEY_HERE', project.publicKey);
  }, [project?.publicKey]);

  const handleCopyPublicKey = useCallback(async () => {
    if (!project?.publicKey) return;

    await navigator.clipboard.writeText(project.publicKey);
    setCopiedKey(true);
    window.setTimeout(() => setCopiedKey(false), 2000);
  }, [project?.publicKey]);

  const handleCopyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 2000);
  }, [promptText]);

  const handleOpenDocs = useCallback(() => {
    window.open('/docs', '_blank');
  }, []);

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      showCloseButton={false}
      panelClassName="max-w-4xl rounded-none border-2 border-black shadow-[10px_10px_0_0_rgba(0,0,0,1)]"
      bodyClassName="p-0"
    >
      <div className="overflow-hidden rounded-none bg-white">
        <div className="border-b-2 border-black bg-[#f8fafc] px-8 py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-white text-black shadow-neo-sm">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="mb-2 inline-flex items-center gap-2 border-2 border-black bg-[#86efac] px-3 py-1 text-[11px] font-black uppercase text-black shadow-neo-sm">
                  Project Ready
                </div>
                <h2 className="text-2xl font-black uppercase text-black">
                  {project.name} is set up and ready for integration.
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
                  Copy the public key or grab a ready-to-paste AI setup prompt with this project already filled in.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="border-2 border-black bg-[#67e8f9] px-3 py-1 text-[11px] font-black uppercase text-black shadow-neo-sm">
                    {getProjectPlatformLabel(project)}
                  </span>
                  {project.bundleId && (
                    <span className="border-2 border-black bg-white px-3 py-1 font-mono text-[11px] text-slate-700 shadow-neo-sm">
                      iOS: {project.bundleId}
                    </span>
                  )}
                  {project.packageName && (
                    <span className="border-2 border-black bg-white px-3 py-1 font-mono text-[11px] text-slate-700 shadow-neo-sm">
                      Android: {project.packageName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black bg-white p-2 text-black shadow-neo-sm transition-all hover:-translate-y-0.5 hover:shadow-neo"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-8 py-7">
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <section className="border-2 border-black bg-white p-5 shadow-neo-sm rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-black">
                    <KeyRound className="h-4 w-4 text-black" />
                    Public key
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Use this in `Rejourney.init(...)`. It is safe to ship in the client app.
                  </p>
                </div>
              </div>

              <div className="mt-4 border-2 border-black bg-white px-4 py-3 font-mono text-[13px] leading-6 text-black break-all shadow-neo-sm">
                {project.publicKey}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleCopyPublicKey}
                  className="rounded-none border-2 border-black bg-[#86efac] font-black uppercase tracking-wide text-black shadow-neo-sm hover:bg-[#4ade80]"
                >
                  {copiedKey ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copiedKey ? 'Public key copied' : 'Copy public key'}
                </Button>
              </div>
            </section>

            <section className="border-2 border-black bg-white p-5 shadow-neo-sm rounded-none">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-black">
                <Sparkles className="h-4 w-4 text-black" />
                AI setup prompt
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                This copies a smart integration prompt with your new project key already inserted.
                It supports both React Native and native Swift (iOS) setup flows.
              </p>

              <div className="mt-4 border-2 border-black bg-white px-4 py-3 text-xs font-semibold leading-6 text-slate-700 shadow-neo-sm">
                Includes install steps, initialization, screen tracking, privacy notes, and your project key.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={handleCopyPrompt}
                  className="rounded-none border-2 border-black bg-[#60a5fa] font-black uppercase tracking-wide text-black shadow-neo-sm hover:bg-[#3b82f6]"
                >
                  {copiedPrompt ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {copiedPrompt ? 'Prompt copied' : 'Copy AI prompt'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenDocs}
                  className="rounded-none border-2 border-black bg-[#c4b5fd] font-black uppercase tracking-wide text-black shadow-neo-sm hover:bg-[#a78bfa]"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open docs
                </Button>
              </div>
            </section>
          </div>

          <section className="border-2 border-black bg-white px-5 py-4 shadow-neo-sm rounded-none">
            <h3 className="text-sm font-black uppercase text-black">Recommended next steps</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="border-2 border-black bg-[#fafafa] p-4 shadow-neo-sm rounded-none">
                <div className="text-[11px] font-black uppercase text-black">Step 1</div>
                <p className="mt-2 text-sm font-semibold text-black">Pick your stack: React Native SDK or native Swift package.</p>
              </div>
              <div className="border-2 border-black bg-[#fafafa] p-4 shadow-neo-sm rounded-none">
                <div className="text-[11px] font-black uppercase text-black">Step 2</div>
                <p className="mt-2 text-sm font-semibold text-black">Initialize the SDK with this project’s public key.</p>
              </div>
              <div className="border-2 border-black bg-[#fafafa] p-4 shadow-neo-sm rounded-none">
                <div className="text-[11px] font-black uppercase text-black">Step 3</div>
                <p className="mt-2 text-sm font-semibold text-black">Ship a test build and confirm new sessions start appearing in the dashboard.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t-2 border-black bg-[#f8fafc] px-8 py-5 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            className="rounded-none border-2 border-black bg-white font-black uppercase tracking-wide text-black shadow-neo-sm hover:bg-slate-100"
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenDocs}
            className="rounded-none border-2 border-black bg-black font-black uppercase tracking-wide text-white shadow-neo-sm hover:bg-slate-800"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View full docs
          </Button>
        </div>
      </div>
    </Modal>
  );
};
