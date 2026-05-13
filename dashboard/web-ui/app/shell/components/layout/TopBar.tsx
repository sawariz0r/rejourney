import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Project } from '~/shared/types';
import { useSessionData } from '~/shared/providers/SessionContext';
import { useAuth } from '~/shared/providers/AuthContext';
import { useTeam } from '~/shared/providers/TeamContext';
import { usePathPrefix } from '~/shell/routing/usePathPrefix';
import { clearCache, getTeamBillingUsage, getTeamPlan, TeamUsage } from '~/features/app/billing/api';
import { clearCacheMatching } from '~/shared/api/client';
import { RefreshCw, User as UserIcon, LogOut, ChevronDown, CreditCard, Copy, BookOpen, Check, Menu, Mail } from 'lucide-react';
import { AI_INTEGRATION_PROMPT } from '~/shared/constants/aiPrompts';
import { DASHBOARD_MANUAL_REFRESH_COMPLETE, DASHBOARD_MANUAL_REFRESH_START } from '~/shared/constants/events';

interface TopBarProps {
  currentProject: Project | null;
}

export const TopBar: React.FC<TopBarProps> = ({ currentProject }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const { refreshSessions } = useSessionData();
  const { user, logout } = useAuth();
  const { currentTeam } = useTeam();
  const pathPrefix = usePathPrefix();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [refreshCompletedPulse, setRefreshCompletedPulse] = useState(false);
  const [teamUsage, setTeamUsage] = useState<TeamUsage | null>(null);
  const [teamPlan, setTeamPlan] = useState<{ planName: string; sessionLimit: number; videoRetentionLabel: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedContactEmail, setCopiedContactEmail] = useState(false);
  const [copiedDocs, setCopiedDocs] = useState(false);
  const refreshPulseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDashboardCachesForRefresh = useCallback(() => {
    clearCache('projects:list');
    if (currentTeam?.id) {
      clearCache(`/api/teams/${currentTeam.id}/billing/plan`);
      clearCache(`/api/teams/${currentTeam.id}/billing/usage`);
      clearCache(`/api/teams/${currentTeam.id}/billing/dashboard`);
    }

    if (!currentProject?.id) return;
    clearCacheMatching((key) => (
      key.includes(`projectId=${currentProject.id}`)
      || key.includes(`:${currentProject.id}:`)
      || key.startsWith(`/api/projects/${currentProject.id}`)
      || key.startsWith(`/api/session/`)
    ));
  }, [currentProject?.id, currentTeam?.id]);

  // Handle refresh - clear cache first then refetch
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent(DASHBOARD_MANUAL_REFRESH_START, { detail: { at: Date.now() } }));
    let success = false;

    try {
      clearDashboardCachesForRefresh();
      await refreshSessions();
      // Also refresh team usage and plan
      if (currentTeam) {
        try {
          const [planData, usageData] = await Promise.all([
            getTeamPlan(currentTeam.id).catch(() => null),
            getTeamBillingUsage(currentTeam.id).catch(() => null),
          ]);

          if (planData) {
            setTeamPlan({
              planName: planData.planName || 'free',
              sessionLimit: planData.sessionLimit || 5000,
              videoRetentionLabel: planData.videoRetentionLabel || '7 days',
            });
          }

          setTeamUsage(usageData?.usage ?? null);
        } catch (e) {
          console.error("Failed to refresh team billing data", e);
        }
      }
      const now = new Date();
      setLastRefreshTime(now);
      setRefreshCompletedPulse(true);
      if (refreshPulseTimeoutRef.current) {
        clearTimeout(refreshPulseTimeoutRef.current);
      }
      refreshPulseTimeoutRef.current = setTimeout(() => {
        setRefreshCompletedPulse(false);
      }, 700);
      success = true;
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    } finally {
      setIsRefreshing(false);
      window.dispatchEvent(new CustomEvent(DASHBOARD_MANUAL_REFRESH_COMPLETE, { detail: { at: Date.now(), success } }));
    }
  }, [clearDashboardCachesForRefresh, refreshSessions, currentTeam]);

  // Fetch team usage and plan when team changes
  useEffect(() => {
    if (currentTeam) {
      Promise.all([
        getTeamPlan(currentTeam.id).catch(() => null),
        getTeamBillingUsage(currentTeam.id).catch(() => null),
      ]).then(([planData, usageData]) => {
        if (planData) {
          setTeamPlan({
            planName: planData.planName || 'free',
            sessionLimit: planData.sessionLimit || 5000,
            videoRetentionLabel: planData.videoRetentionLabel || '7 days',
          });
        }
        setTeamUsage(usageData?.usage ?? null);
      }).catch(err => console.error("Failed to load team billing data:", err));
    } else {
      setTeamUsage(null);
      setTeamPlan(null);
    }
  }, [currentTeam]);

  // Listen for plan changes to refresh usage and plan
  useEffect(() => {
    const handlePlanChanged = (event: CustomEvent) => {
      if (currentTeam && event.detail?.teamId === currentTeam.id) {
        clearCache(`/api/teams/${currentTeam.id}/billing/plan`);
        clearCache(`/api/teams/${currentTeam.id}/billing/usage`);
        clearCache(`/api/teams/${currentTeam.id}/billing/dashboard`);
        Promise.all([
          getTeamPlan(currentTeam.id).catch(() => null),
          getTeamBillingUsage(currentTeam.id).catch(() => null),
        ]).then(([planData, usageData]) => {
          if (planData) {
            setTeamPlan({
              planName: planData.planName || 'free',
              sessionLimit: planData.sessionLimit || 5000,
              videoRetentionLabel: planData.videoRetentionLabel || '7 days',
            });
          }
          setTeamUsage(usageData?.usage ?? null);
        }).catch(err => console.error("Failed to refresh team billing data:", err));
      }
    };

    window.addEventListener('planChanged', handlePlanChanged as EventListener);
    return () => {
      window.removeEventListener('planChanged', handlePlanChanged as EventListener);
    };
  }, [currentTeam]);

  useEffect(() => {
    return () => {
      if (refreshPulseTimeoutRef.current) {
        clearTimeout(refreshPulseTimeoutRef.current);
      }
    };
  }, []);

  // Display Name Logic - prioritize email
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const displayLabel = userName
    ? (userName.length > 20 ? `${userName.substring(0, 18)}...` : userName)
    : (userEmail.length > 20 ? `${userEmail.substring(0, 18)}...` : userEmail);

  const sessionsUsed = teamUsage?.sessionsUsed ?? 0;

  const planLabel = user?.isSelfHosted
    ? 'Self-Hosted'
    : (teamPlan?.planName ? teamPlan.planName.charAt(0).toUpperCase() + teamPlan.planName.slice(1) : 'Free');

  // Copy handlers
  const handleCopyPublicKey = useCallback(() => {
    if (currentProject?.publicKey) {
      navigator.clipboard.writeText(currentProject.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  }, [currentProject?.publicKey]);

  const handleCopyDocsUrl = useCallback(() => {
    navigator.clipboard.writeText(AI_INTEGRATION_PROMPT);
    setCopiedDocs(true);
    setTimeout(() => setCopiedDocs(false), 2000);
  }, []);

  const handleCopyContactEmail = useCallback(() => {
    navigator.clipboard.writeText('contact@rejourney.co');
    setCopiedContactEmail(true);
    setTimeout(() => setCopiedContactEmail(false), 2000);
  }, []);

  // Truncate public key for display
  const truncatedKey = currentProject?.publicKey
    ? `${currentProject.publicKey.slice(0, 8)}...${currentProject.publicKey.slice(-4)}`
    : '';

  const refreshTitle = isRefreshing
    ? 'Refreshing dashboard data...'
    : `Refresh data (last: ${lastRefreshTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;

  return (
    <div className="dashboard-topbar relative z-10 flex flex-col gap-2 px-3 py-2.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-x-3">
      <div className="flex w-full min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggleMobileSidebar'))}
          className="mr-1 flex h-8 w-8 items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 md:hidden transition-colors shadow-sm"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4 stroke-[3]" />
        </button>

        {/* Logo */}
        <Link to="/" className="shrink-0 hover:scale-105 transition-transform active:scale-95">
          <img src="/rejourneyIcon-removebg-preview.png" alt="Rejourney" className="w-8 h-8 object-contain drop-shadow-sm" />
        </Link>
        <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>

        {currentProject ? (
          <>
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="truncate text-sm font-bold leading-none text-slate-900">{currentProject.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {currentProject.platforms.map((platform, index) => (
                  <span key={platform} className={`flex items-center gap-1 px-1.5 py-px text-[10px] font-semibold uppercase text-slate-700 border border-slate-200 rounded-sm ${index % 2 === 0 ? 'bg-cyan-50' : 'bg-emerald-50'}`}>
                    {platform}
                  </span>
                ))}
                {teamPlan?.videoRetentionLabel && (
                  <span className="flex items-center gap-1 bg-pink-50 px-1.5 py-px text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-sm">
                    {teamPlan.videoRetentionLabel} video retention
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm font-semibold text-slate-500">Select a project</div>
        )}
      </div>

      <div className="dashboard-topbar-actions flex w-full min-w-0 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-0.5 lg:w-auto lg:justify-end lg:gap-2 lg:overflow-visible lg:pb-0">
        {/* Public Key - Truncated & Copyable */}
        {currentProject?.publicKey && (
          <button
            onClick={handleCopyPublicKey}
            className="group hidden h-9 shrink-0 items-center gap-2 border border-slate-200 bg-white px-3 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:shadow-none 2xl:flex"
            title={`Copy Public Key: ${currentProject.publicKey}`}
            aria-label="Copy public key"
          >
            <span className="font-mono text-black font-bold text-xs">{truncatedKey}</span>
            {copiedKey ? (
              <Check className="w-4 h-4 text-black stroke-[3]" />
            ) : (
              <Copy className="w-4 h-4 text-black group-hover:text-[#5dadec] transition-colors stroke-[2]" />
            )}
          </button>
        )}

        {/* Contact Devs Button */}
        <button
          onClick={handleCopyContactEmail}
          className="group flex h-9 shrink-0 items-center gap-2 border border-slate-200 bg-white px-3 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:shadow-none"
          title="Copy developer contact email: contact@rejourney.co"
          aria-label="Copy developer contact email"
        >
          <Mail className="w-4 h-4 text-black stroke-[2]" />
          <span className="hidden 2xl:inline text-xs font-bold">Contact Our Devs</span>
          {copiedContactEmail ? (
            <Check className="w-4 h-4 text-black stroke-[3]" />
          ) : (
            <Copy className="w-4 h-4 text-black group-hover:text-[#5dadec] transition-colors stroke-[2]" />
          )}
        </button>

        {/* AI Docs Button */}
        <button
          onClick={handleCopyDocsUrl}
          className="group flex h-9 shrink-0 items-center gap-2 border border-slate-200 bg-white px-3 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:shadow-none"
          title="Copy AI Integration Prompt"
          aria-label="Copy AI integration prompt"
        >
          <BookOpen className="w-4 h-4 text-black stroke-[2]" />
          <span className="hidden xl:inline text-xs font-bold">AI Docs</span>
          {copiedDocs ? (
            <Check className="w-4 h-4 text-black stroke-[3]" />
          ) : (
            null
          )}
        </button>

        {/* Refresh Button - Icon Only */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 shadow-sm transition-all active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${isRefreshing
            ? 'bg-white'
            : refreshCompletedPulse
              ? 'bg-emerald-100 border-emerald-200'
              : 'bg-white hover:bg-slate-50 hover:border-slate-300'
            }`}
          title={refreshTitle}
        >
          <RefreshCw className={`w-4 h-4 text-black stroke-[3] ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Plan / Usage - Team usage this month */}
        {user && currentTeam && (
          <Link
            to={`${pathPrefix}/team`}
            className="hidden h-9 shrink-0 items-center gap-2 border border-slate-200 bg-emerald-50 px-3 shadow-sm transition-all hover:bg-emerald-100 hover:border-slate-300 active:shadow-none 2xl:flex"
            title={`${currentTeam.name} - Usage this month`}
          >
            <span className="text-xs font-bold text-black">{planLabel}</span>
            <span className="h-4 w-px bg-slate-700/40"></span>
            <span className="text-sm font-extrabold text-black">{sessionsUsed.toLocaleString()}</span>
          </Link>
        )}

        {/* User Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="group flex h-9 max-w-full items-center gap-2 border border-slate-200 bg-white px-2 py-1 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:shadow-none focus:outline-none"
          >
            <div className="w-5 h-5 bg-slate-700 flex items-center justify-center text-white rounded-sm">
              <UserIcon className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div className="hidden min-w-0 xl:block">
              <div className="max-w-[100px] truncate text-xs font-bold text-black">{displayLabel}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-black stroke-[3]" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 p-1 shadow-lg rounded-md z-[100] w-56 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-1 border-b border-slate-100 bg-slate-50 px-4 py-3 rounded-t-sm">
                  <div className="truncate text-xs font-bold text-black">{displayLabel}</div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">{userEmail}</div>
                </div>
                <button
                  onClick={() => navigate(`${pathPrefix}/account`)}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-black hover:bg-[#ecfeff] flex items-center gap-2"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  Account
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-[#fecaca] flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5 stroke-[2px]" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
