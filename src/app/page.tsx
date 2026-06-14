import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-deep-navy text-brand-white font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Decorative Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #00C2CB 1px, transparent 1.5px)`,
          backgroundSize: "32px 32px"
        }}
      />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-subtle-blue-gray/30">
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
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <Button variant="ghost" className="text-brand-gray hover:text-white hover:bg-subtle-blue-gray/30 font-medium">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className="bg-electric-blue hover:bg-electric-blue/80 text-white font-semibold shadow-md shadow-electric-blue/20">
              Get Started
            </Button>
          </SignUpButton>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto w-full px-6 py-20 lg:py-32 flex flex-col items-center text-center flex-1 justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-soft-teal/10 border border-soft-teal/20 text-soft-teal text-xs font-semibold uppercase tracking-wider mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Now Powered by Gemini 2.5 Flash
        </div>

        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight text-white mb-6 font-heading max-w-4xl">
          The professional way to split expenses, <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-soft-teal">simplified.</span>
        </h1>
        
        <p className="text-brand-gray text-lg lg:text-xl mb-12 max-w-2xl leading-relaxed">
          Import messy CSV spreadsheets, automatically detect data quality issues before they corrupt your balances, and generate AI breakdown summaries in plain English.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
          <SignUpButton mode="modal">
            <Button size="lg" className="w-full sm:w-auto bg-electric-blue hover:bg-electric-blue/80 text-white text-base font-bold py-6 px-10 shadow-lg shadow-electric-blue/30 transition-all hover:scale-[1.02]">
              Create Free Account
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-subtle-blue-gray text-white hover:bg-subtle-blue-gray/30 text-base font-semibold py-6 px-10">
              Sign In
            </Button>
          </SignInButton>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="bg-dark-navy-surface rounded-2xl p-8 border border-subtle-blue-gray/40 hover:border-soft-teal/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3 font-heading">Smart CSV Importer</h3>
            <p className="text-sm text-brand-gray leading-relaxed">
              Detects 8+ categories of messy data errors (duplicates, negative amounts, settlements, name variants) on the fly.
            </p>
          </div>

          <div className="bg-dark-navy-surface rounded-2xl p-8 border border-subtle-blue-gray/40 hover:border-electric-blue/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center text-electric-blue mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1M10 21h4a2 2 0 002-2V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3 font-heading">Debt Simplification</h3>
            <p className="text-sm text-brand-gray leading-relaxed">
              Minimizes transactions using our balance netting algorithm to resolve all outstanding balances in the group.
            </p>
          </div>

          <div className="bg-dark-navy-surface rounded-2xl p-8 border border-subtle-blue-gray/40 hover:border-soft-teal/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V21h2v-2.243a4.978 4.978 0 01-1.07-3.293C11 12.552 11.448 12 12 12s1 .552 1 1.293a4.978 4.978 0 01-1.07 3.293V21h2v-5.457" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3 font-heading">AI Summarization</h3>
            <p className="text-sm text-brand-gray leading-relaxed">
              Provides plain-English balance summaries of who owes whom and why, eliminating calculations and confusion.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-xs text-brand-gray/50 border-t border-subtle-blue-gray/20">
        &copy; {new Date().getFullYear()} Splitwise Smart. Professional expense management.
      </footer>
    </main>
  );
}
