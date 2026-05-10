import React from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '~/shared/ui/core/Button';
import { useAuth } from '~/shared/providers/AuthContext';
import { ExternalLink } from 'lucide-react';
import { getMarketingHomeCopy, getMarketingLocaleFromPathname } from '~/shared/lib/internationalMarketing';

export const Header: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const locale = getMarketingLocaleFromPathname(location.pathname);
  const copy = getMarketingHomeCopy(location.pathname).header;

  return (
    <header aria-label={copy.ariaLabel} className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-nowrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:max-w-[98%] lg:px-6">
        <Link to={locale.path} className="flex items-center gap-2 hover:opacity-80 transition-opacity group animate-scale-in">
          <div className="flex h-9 w-9 items-center justify-center transition-transform group-hover:rotate-6 sm:h-10 sm:w-10">
            <img src="/rejourneyIcon-removebg-preview.png" alt={copy.logoAlt} className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
          </div>
          <span className="text-lg font-black tracking-tighter uppercase font-mono text-slate-900 group-hover:text-[#5dadec] transition-colors sm:text-xl">REJOURNEY</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex xl:gap-8">
          <Link
            to="/engineering"
            className="text-base font-bold uppercase tracking-wide hover:underline decoration-2 underline-offset-4 decoration-slate-900 text-slate-900 font-mono"
          >
            {copy.engineering}
          </Link>
          <Link
            to="/docs/reactnative/overview"
            className="text-base font-bold uppercase tracking-wide hover:underline decoration-2 underline-offset-4 decoration-slate-900 text-slate-900 font-mono"
          >
            {copy.docs}
          </Link>
          <Link
            to="/pricing"
            className="text-base font-bold uppercase tracking-wide hover:underline decoration-2 underline-offset-4 decoration-slate-900 text-slate-900 font-mono"
          >
            {copy.pricing}
          </Link>
          <a
            href="https://github.com/rejourneyco/rejourney"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-base font-bold uppercase tracking-wide hover:underline decoration-2 underline-offset-4 decoration-slate-900 text-slate-900 font-mono"
          >
            <ExternalLink className="w-5 h-5" />
            {copy.github}
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/docs/selfhosted">
            <Button variant="ghost" className="font-mono uppercase font-black text-sm px-6 py-2 border-2 border-transparent hover:border-black transition-all rounded-none hidden md:flex">
              {copy.selfHosted}
            </Button>
          </Link>
          <Link to={isAuthenticated ? "/dashboard/general" : "/login"}>
            <Button variant="ghost" className="font-mono uppercase font-black text-xs sm:text-sm px-3 sm:px-6 py-2 border-2 border-black bg-white text-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all rounded-none">
              {isAuthenticated ? copy.dashboard : copy.login}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
