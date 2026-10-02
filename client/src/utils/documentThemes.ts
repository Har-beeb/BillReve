export type DocumentTheme = 'standard' | 'professional' | 'modern' | 'classic' | 'monochrome';

export function getThemeStyles(theme: DocumentTheme = 'standard') {
  const themes = {
    standard: {
      docWrapper: 'border-t-4 border-slate-800',
      header: 'bg-white',
      title: 'text-slate-800',
      detailsGrid: 'bg-white',
      tableWrapper: 'overflow-hidden rounded-lg border border-slate-200',
      tableHead: 'bg-slate-100 text-slate-700 font-semibold',
      tableStripe: 'bg-slate-50',
      totalRow: 'border-t-2 border-slate-800',
      accentText: 'text-slate-800',
    },
    professional: {
      docWrapper: 'border-l-4 border-purple-600',
      header: 'bg-purple-600 text-white',
      title: 'text-white',
      detailsGrid: 'bg-slate-50 rounded-xl p-6',
      tableWrapper: 'overflow-hidden rounded-xl border border-purple-100',
      tableHead: 'bg-purple-50 text-purple-800 font-semibold',
      tableStripe: 'bg-purple-50/50',
      totalRow: 'border-t-2 border-purple-600',
      accentText: 'text-purple-700',
    },
    modern: {
      docWrapper: 'bg-purple-50/10 border-2 border-purple-100 rounded-3xl overflow-hidden',
      header: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8',
      title: 'text-white',
      detailsGrid: 'bg-white rounded-2xl shadow-sm p-6 border border-slate-100',
      tableWrapper: 'overflow-hidden rounded-2xl border border-slate-100 shadow-sm',
      tableHead: 'bg-purple-50 text-purple-700 font-bold',
      tableStripe: 'bg-purple-50/30',
      totalRow: 'border-t-2 border-purple-400',
      accentText: 'text-purple-600',
    },
    classic: {
      docWrapper: 'border-4 border-double border-slate-300',
      header: 'bg-amber-50 border-b-2 border-amber-200 p-8',
      title: 'text-amber-900',
      detailsGrid: 'bg-white border border-amber-100 p-6',
      tableWrapper: 'overflow-hidden border-2 border-slate-200',
      tableHead: 'bg-amber-50 text-amber-900 font-serif',
      tableStripe: 'bg-amber-50/50',
      totalRow: 'border-t-2 border-amber-300',
      accentText: 'text-amber-800',
    },
    monochrome: {
      docWrapper: 'border-4 border-black bg-white',
      header: 'bg-black text-white p-8',
      title: 'text-white tracking-widest uppercase',
      detailsGrid: 'bg-gray-50 border border-gray-200 p-6',
      tableWrapper: 'overflow-hidden border-2 border-black',
      tableHead: 'bg-gray-900 text-white font-bold uppercase tracking-wider',
      tableStripe: 'bg-gray-100',
      totalRow: 'border-t-4 border-black',
      accentText: 'text-black',
    },
  };
  return themes[theme] || themes.standard;
}

export function getThemeInlineStyles(theme: DocumentTheme = 'standard') {
  const themes = {
    standard: {
      headerBg: '#ffffff', headerText: '#0f172a',
      tableHeadBg: '#f1f5f9', tableHeadText: '#334155',
      stripeBg: '#f8fafc', accentColor: '#0f172a',
      borderColor: '#0f172a',
    },
    professional: {
      headerBg: '#9333ea', headerText: '#ffffff',
      tableHeadBg: '#faf5ff', tableHeadText: '#6b21a8',
      stripeBg: '#faf5ff80', accentColor: '#7c3aed',
      borderColor: '#9333ea',
    },
    modern: {
      headerBg: 'linear-gradient(to right, #9333ea, #4f46e5)', headerText: '#ffffff',
      tableHeadBg: '#faf5ff', tableHeadText: '#6d28d9',
      stripeBg: '#faf5ff50', accentColor: '#9333ea',
      borderColor: '#a78bfa',
    },
    classic: {
      headerBg: '#fffbeb', headerText: '#78350f',
      tableHeadBg: '#fffbeb', tableHeadText: '#78350f',
      stripeBg: '#fffbeb80', accentColor: '#92400e',
      borderColor: '#fbbf24',
    },
    monochrome: {
      headerBg: '#000000', headerText: '#ffffff',
      tableHeadBg: '#111827', tableHeadText: '#ffffff',
      stripeBg: '#f3f4f6', accentColor: '#000000',
      borderColor: '#000000',
    },
  };
  return themes[theme] || themes.standard;
}
