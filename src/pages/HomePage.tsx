import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, GraduationCap, ScanLine, ArrowRight } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-mono-50 flex flex-col justify-center text-mono-900 font-sans">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12 sm:py-16">
        {/* Hero Identity Badge (Exam Proctor Pattern) */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-mono-950 text-white shadow-sm">
            <ShieldCheck className="size-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-mono-950">
            TCC Event Clearance
          </h1>
          <p className="text-sm text-mono-500 max-w-xs mx-auto">
            Tagoloan Community College activity card and event attendance system.
          </p>
        </div>

        {/* Action Cards Container */}
        <div className="space-y-4">
          {/* Card 1: Student Portal */}
          <div className="group flex flex-col overflow-hidden rounded-xl bg-white border border-mono-200 ring-1 ring-mono-900/5 shadow-sm text-sm">
            <div className="p-6 space-y-1.5">
              <div className="size-9 rounded-lg bg-mono-100 flex items-center justify-center text-mono-700 mb-2">
                <GraduationCap className="size-5" />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-mono-950">
                Student Portal
              </h2>
              <p className="text-sm text-mono-500 leading-relaxed">
                Open your digital activity card, show your live QR code at the entrance, and see your signed slots.
              </p>
            </div>

            <div className="flex items-center border-t border-mono-200 bg-mono-50/80 p-4">
              <Link
                to="/student"
                className="inline-flex w-full h-10 items-center justify-center rounded-lg bg-mono-950 hover:bg-mono-800 text-white text-sm font-medium transition active:scale-[0.98] gap-2"
              >
                <span>Open Student Card</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: SBO Officer Portal */}
          <div className="group flex flex-col overflow-hidden rounded-xl bg-white border border-mono-200 ring-1 ring-mono-900/5 shadow-sm text-sm">
            <div className="p-6 space-y-1.5">
              <div className="size-9 rounded-lg bg-mono-100 flex items-center justify-center text-mono-700 mb-2">
                <ScanLine className="size-5" />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-mono-950">
                SBO Officer Portal
              </h2>
              <p className="text-sm text-mono-500 leading-relaxed">
                Scan student QR codes offline at the venue, verify attendance records, and check graduation clearance.
              </p>
            </div>

            <div className="flex items-center border-t border-mono-200 bg-mono-50/80 p-4">
              <Link
                to="/sbo"
                className="inline-flex w-full h-10 items-center justify-center rounded-lg border border-mono-200 bg-white hover:bg-mono-100 text-mono-950 text-sm font-medium transition active:scale-[0.98] gap-2"
              >
                <span>Open SBO Scanner</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-mono-400">
          Tagoloan Community College &bull; Activity Card Clearance System
        </div>
      </main>
    </div>
  );
};

