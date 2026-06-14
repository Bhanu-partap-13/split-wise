"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-deep-navy font-sans text-brand-white">
      {/* Left Column: Spreetail-inspired branding panel */}
      <div className="hidden md:flex md:w-[45%] bg-[#0A0F1E] flex-col justify-between p-16 border-r border-subtle-blue-gray relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #00C2CB 1px, transparent 1.5px)`,
            backgroundSize: "24px 24px"
          }}
        />

        {/* Branding header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-electric-blue flex items-center justify-center shadow-lg shadow-electric-blue/30 border border-electric-blue/50">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight font-heading">
              Splitwise <span className="text-soft-teal">Smart</span>
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="my-auto relative z-10 max-w-md">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white mb-6 font-heading">
            Settle expenses without the <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-soft-teal">awkwardness.</span>
          </h1>
          <p className="text-brand-gray text-lg mb-10 leading-relaxed">
            Keep track of shared bills, coordinate household expenses, and settle debts with friends instantly and professionally.
          </p>

          <ul className="space-y-5">
            <li className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-soft-teal/10 border border-soft-teal/30 flex items-center justify-center shrink-0 mt-1">
                <svg className="w-3.5 h-3.5 text-soft-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white font-heading">Instant Group Balancing</h4>
                <p className="text-sm text-brand-gray">Check outstanding balances in real time across any number of shared groups.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-soft-teal/10 border border-soft-teal/30 flex items-center justify-center shrink-0 mt-1">
                <svg className="w-3.5 h-3.5 text-soft-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white font-heading">Multiple Currency Conversions</h4>
                <p className="text-sm text-brand-gray">Set default currencies and track expenses with automated FX conversion rates.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-brand-gray/60">
          &copy; {new Date().getFullYear()} Splitwise Smart. Professional expense management.
        </div>

        {/* Vertical marquee of categories */}
        <div className="absolute inset-y-0 right-0 w-24 bg-[#080d1a] border-l border-subtle-blue-gray overflow-hidden opacity-30 select-none">
          <div className="flex flex-col gap-12 py-8 items-center animate-marquee-vertical">
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-electric-blue">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-electric-blue">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            </div>
            {/* Duplicates */}
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-electric-blue">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-electric-blue">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div className="p-3 bg-dark-navy-surface rounded-xl border border-subtle-blue-gray text-soft-teal">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Standard Clerk SignIn component */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:px-16 lg:px-24">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-2 mb-8 self-start">
          <div className="w-8 h-8 rounded-lg bg-electric-blue flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight font-heading">
            Splitwise <span className="text-soft-teal">Smart</span>
          </span>
        </div>

        <div className="w-full flex justify-center">
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/signup"
            forceRedirectUrl="/auth/callback"
            signUpForceRedirectUrl="/auth/callback"
          />
        </div>
      </div>
    </div>
  );
}
