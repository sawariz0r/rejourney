import React from 'react';
import { Link } from 'react-router';
import { useToast } from '~/shared/providers/ToastContext';

export const Footer: React.FC = () => {
  const { showToast } = useToast();

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText('contact@rejourney.co');
    showToast('Email copied to clipboard!');
  };

  return (
    <footer className="border-t border-input bg-background mt-16">
      <div className="container mx-auto px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-center text-xs font-mono font-bold uppercase tracking-tight text-gray-500 sm:text-sm">
          <Link to="/dashboard/general" className="hover:text-black transition-colors">Dashboard</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/docs/reactnative/overview" className="hover:text-black transition-colors">Docs</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/engineering" className="hover:text-black transition-colors">Engineering</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/changelog" className="hover:text-black transition-colors">Changelog</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/pricing" className="hover:text-black transition-colors">Pricing</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/docs/selfhosted" className="hover:text-black transition-colors">Self Hosted</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/login" className="hover:text-black transition-colors">Login</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/terms-of-service" className="hover:text-black transition-colors">Terms</Link>
          <span className="hidden sm:inline">•</span>
          <Link to="/privacy-policy" className="hover:text-black transition-colors">Privacy</Link>
          <span className="hidden sm:inline">•</span>
          <button onClick={handleCopyEmail} className="hover:text-black transition-colors uppercase">
            Contact
          </button>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://x.com/rejourneyco"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black transition-colors"
            aria-label="Rejourney on X"
          >
            X
          </a>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://github.com/rejourneyco"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black transition-colors"
            aria-label="Rejourney on GitHub"
          >
            GitHub
          </a>
        </div>
        <div className="text-center text-sm text-muted-foreground mt-4">
          © 2026 Rejourney. All rights reserved.
        </div>
      </div>
    </footer>
  );
};


