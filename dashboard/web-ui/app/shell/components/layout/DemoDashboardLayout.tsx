/**
 * Demo Dashboard Layout
 * 
 * A variant of the dashboard layout for demo mode.
 * Reuses the real Sidebar and TopBar components to maintain consistency.
 * Injects demo data instead of fetching from APIs.
 */

import React from 'react';
import { Outlet, Link } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useDemoMode } from '~/shared/providers/DemoModeContext';
import { useSessionData } from '~/shared/providers/SessionContext';

export const DemoDashboardLayout: React.FC = () => {
    const { demoProjects } = useDemoMode();
    const { selectedProject, setSelectedProject, projects } = useSessionData();

    // Use demo projects for the sidebar
    const handleProjectChange = (project: any) => {
        setSelectedProject(project);
    };

    // Demo team placeholder
    const demoTeam = {
        id: 'demo-team',
        name: 'Demo Team',
        ownerUserId: 'demo-user',
        billingPlan: 'free' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    return (
        <div className="dashboard-modern dashboard-shell flex h-screen">
            <div className="w-0 shrink-0 overflow-visible bg-white md:w-auto md:shrink-0">
                <Sidebar
                    currentProject={selectedProject}
                    onProjectChange={handleProjectChange}
                    projects={projects.length > 0 ? projects : demoProjects}
                    loading={false}
                    teams={[demoTeam]}
                    currentTeam={demoTeam}
                    onTeamChange={() => { }}
                    teamsLoading={false}
                    pathPrefix="/demo"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--dashboard-canvas)]">
                {/* Demo Banner */}
                <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#e0f2fe] px-4 py-2 text-slate-900 shadow-sm">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="w-2 h-2 border border-black bg-[#86efac] animate-pulse" />
                        <span className="text-sm font-black uppercase">
                            You're viewing a demo with sample data.
                            <Link to="/" className="ml-1 underline decoration-2 underline-offset-2 hover:opacity-80">
                                Exit demo
                            </Link>
                        </span>
                    </div>
                    <Link
                        to="/login"
                        className="border border-slate-300 bg-white px-3 py-1 text-xs font-black uppercase text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-[#ecfeff]"
                    >
                        Sign Up
                    </Link>
                </div>

                {/* Same TopBar as real dashboard */}
                <TopBar currentProject={selectedProject} />

                {/* Page Content */}
                <div className="dashboard-content dashboard-surface-mix flex-1 overflow-y-auto overflow-x-hidden pb-10 pt-0">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};
