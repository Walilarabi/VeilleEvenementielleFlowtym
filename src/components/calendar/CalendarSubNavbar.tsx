/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutList,
  Calendar,
  Flame,
  GraduationCap,
  Database,
  History,
} from 'lucide-react';

export type CalendarSubTabMode = 'table' | 'calendar' | 'heatmap' | 'school_holidays';

interface CalendarSubNavbarProps {
  activeTab: CalendarSubTabMode;
  onChangeTab: (tab: CalendarSubTabMode) => void;
  onOpenSources: () => void;
  onOpenImportHistory: () => void;
  holidaysCount?: number;
}

export const CalendarSubNavbar: React.FC<CalendarSubNavbarProps> = ({
  activeTab,
  onChangeTab,
  onOpenSources,
  onOpenImportHistory,
  holidaysCount = 57,
}) => {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200/90 bg-white px-2 pt-1 pb-0 rounded-2xl shadow-2xs overflow-x-auto">
      {/* 1. Liste */}
      <button
        onClick={() => onChangeTab('table')}
        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer whitespace-nowrap ${
          activeTab === 'table'
            ? 'text-violet-900 border-violet-600 font-extrabold'
            : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300'
        }`}
      >
        <LayoutList className={`w-4 h-4 ${activeTab === 'table' ? 'text-violet-600' : 'text-slate-400'}`} />
        <span>Liste</span>
      </button>

      {/* 2. Calendrier */}
      <button
        onClick={() => onChangeTab('calendar')}
        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer whitespace-nowrap ${
          activeTab === 'calendar'
            ? 'text-violet-900 border-violet-600 font-extrabold'
            : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300'
        }`}
      >
        <Calendar className={`w-4 h-4 ${activeTab === 'calendar' ? 'text-violet-600' : 'text-slate-400'}`} />
        <span>Calendrier</span>
      </button>

      {/* 3. Heatmap */}
      <button
        onClick={() => onChangeTab('heatmap')}
        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer whitespace-nowrap ${
          activeTab === 'heatmap'
            ? 'text-violet-900 border-violet-600 font-extrabold'
            : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300'
        }`}
      >
        <Flame className={`w-4 h-4 ${activeTab === 'heatmap' ? 'text-violet-600' : 'text-slate-400'}`} />
        <span>Heatmap</span>
      </button>

      {/* 4. Vacances scolaires - EXACT MATCH WITH USER SCREENSHOT */}
      <button
        onClick={() => onChangeTab('school_holidays')}
        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer whitespace-nowrap ${
          activeTab === 'school_holidays'
            ? 'text-violet-900 border-violet-600 font-extrabold'
            : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300'
        }`}
      >
        <Calendar className={`w-4 h-4 ${activeTab === 'school_holidays' ? 'text-violet-600' : 'text-slate-400'}`} />
        <span>Vacances scolaires</span>
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
          {holidaysCount}
        </span>
      </button>

      {/* 5. Sources & API */}
      <button
        onClick={onOpenSources}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
      >
        <Database className="w-4 h-4 text-slate-400" />
        <span>Sources & API</span>
      </button>

      {/* 6. Import & Historique */}
      <button
        onClick={onOpenImportHistory}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
      >
        <History className="w-4 h-4 text-slate-400" />
        <span>Import & Historique</span>
      </button>
    </div>
  );
};
