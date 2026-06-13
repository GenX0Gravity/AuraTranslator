'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Users, Plus, Settings, ChevronLeft } from 'lucide-react';
import React, { useState } from 'react';
// I'll fix the import below

// Actually, I will write the component now.

export default function WorkspacePage() {
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = React.useState<any[]>([]);

  // Simple placeholder UI for workspaces
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to Translator
      </Link>
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Team Workspaces
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your shared translation memory and glossaries.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm">
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Default Personal Workspace */}
        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">Personal Workspace</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your private translations</p>
          
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-between text-xs text-slate-500 font-medium">
            <span>1 Member</span>
            <span>0 Glossary Terms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
