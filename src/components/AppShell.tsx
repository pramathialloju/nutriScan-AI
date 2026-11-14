import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AppRoute } from '../lib/routes';

interface AppShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  pageTitle?: string;
  pageSubtitle?: string;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  route: AppRoute;
  label: string;
}> = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'recognition', label: 'Food Scanner' },
  { route: 'recommendations', label: 'Recommendations' },
  { route: 'meal-planner', label: 'Meal Planner' },
  { route: 'diary', label: 'Food Diary' },
  { route: 'analytics', label: 'Analytics' },
];

export function AppShell({
  currentRoute,
  onNavigate,
  pageTitle,
  pageSubtitle,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (route: AppRoute) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 flex flex-col">
      {/* Simple Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            NutriScan <span className="text-emerald-700">AI</span>
          </button>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-1 lg:gap-2"
          >
            {NAV_ITEMS.map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNav(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1"
          >
            {NAV_ITEMS.map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNav(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full text-left px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {currentRoute !== 'dashboard' && pageTitle && (
          <div className="pb-2 border-b border-slate-200">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {pageSubtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
