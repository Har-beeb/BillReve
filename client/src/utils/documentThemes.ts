export type DocumentTheme = 'standard' | 'professional' | 'modern' | 'classic' | 'monochrome';

export function getThemeStyles(theme: DocumentTheme = 'standard') {
  const themes = {
    standard: {
      docWrapper: 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 rounded-xl',
      header: 'bg-white border-b border-slate-100 p-8 md:p-12',
      title: 'text-slate-800 tracking-tight',
      detailsGrid: 'bg-white p-8 md:px-12',
      tableWrapper: 'border-b border-slate-200 mt-4 mx-8 md:mx-12',
      tableHead: 'border-b-2 border-slate-800 bg-white text-slate-800 uppercase text-xs tracking-widest',
      tableStripe: 'bg-white border-b border-slate-50',
      totalRow: 'border-t-2 border-slate-800',
      accentText: 'text-slate-500',
    },
    professional: {
      docWrapper: 'bg-white border-t-8 border-blue-800 shadow-xl rounded-b-xl',
      header: 'bg-slate-50 p-8 md:p-12',
      title: 'text-blue-900',
      detailsGrid: 'bg-white p-8 md:px-12',
      tableWrapper: 'rounded-lg border border-slate-200 shadow-sm overflow-hidden mx-8 md:mx-12 my-6',
      tableHead: 'bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs',
      tableStripe: 'bg-slate-50/40 border-b border-slate-100',
      totalRow: 'border-t-2 border-blue-800',
      accentText: 'text-blue-800',
    },
    modern: {
      docWrapper: 'bg-slate-50/50 rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100',
      header: 'bg-gradient-to-br from-slate-100 via-white to-slate-50 p-10 md:p-14 text-slate-900 pb-20 md:pb-24',
      title: 'text-slate-900 font-extrabold tracking-tighter',
      detailsGrid: 'bg-white mx-6 md:mx-10 -mt-12 md:-mt-16 relative rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgb(0,0,0,0.08)] border border-slate-100 z-10',
      tableWrapper: 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-6 md:mx-10 my-8',
      tableHead: 'bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px]',
      tableStripe: 'bg-white border-b border-slate-50',
      totalRow: 'border-t border-slate-100 bg-white',
      accentText: 'text-slate-900',
    },
    classic: {
      docWrapper: 'bg-[#fcfbf9] border border-[#e5e4e0] shadow-md p-4 md:p-6',
      header: 'border-b-4 border-double border-stone-300 p-6 md:p-8',
      title: 'text-stone-800 font-serif',
      detailsGrid: 'p-6 md:px-8',
      tableWrapper: 'border-y-2 border-stone-300 mx-6 md:mx-8 my-6',
      tableHead: 'bg-stone-100/30 text-stone-800 font-serif italic',
      tableStripe: 'bg-[#fcfbf9] border-b border-stone-100',
      totalRow: 'border-t-4 border-double border-stone-300',
      accentText: 'text-stone-600 font-serif italic',
    },
    monochrome: {
      docWrapper: 'bg-white border-[6px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]',
      header: 'bg-black text-white p-8 md:p-12 border-b-[6px] border-black',
      title: 'text-white uppercase tracking-[0.25em] font-black',
      detailsGrid: 'p-8 md:px-12 border-b-[6px] border-black bg-white',
      tableWrapper: 'border-b-[6px] border-black mx-8 md:mx-12 my-8',
      tableHead: 'bg-white text-black font-black uppercase tracking-widest border-b-[6px] border-black',
      tableStripe: 'bg-white border-b-[3px] border-black',
      totalRow: 'border-t-[6px] border-black bg-white text-black',
      accentText: 'text-black font-black uppercase tracking-widest',
    },
  };
  return themes[theme] || themes.standard;
}

export function getThemeInlineStyles(theme: DocumentTheme = 'standard') {
  const themes = {
    standard: {
      headerBg: '#ffffff', headerText: '#1e293b',
      tableHeadBg: '#ffffff', tableHeadText: '#1e293b',
      stripeBg: '#ffffff', accentColor: '#64748b',
      borderColor: '#1e293b',
    },
    professional: {
      headerBg: '#f8fafc', headerText: '#1e3a8a',
      tableHeadBg: '#f1f5f9', tableHeadText: '#334155',
      stripeBg: '#f8fafc', accentColor: '#1e40af',
      borderColor: '#1e40af',
    },
    modern: {
      headerBg: '#f8fafc', headerText: '#0f172a',
      tableHeadBg: '#f8fafc', tableHeadText: '#64748b',
      stripeBg: '#ffffff', accentColor: '#0f172a',
      borderColor: '#f1f5f9',
    },
    classic: {
      headerBg: '#fcfbf9', headerText: '#292524',
      tableHeadBg: '#f5f5f4', tableHeadText: '#292524',
      stripeBg: '#fcfbf9', accentColor: '#57534e',
      borderColor: '#d6d3d1',
    },
    monochrome: {
      headerBg: '#000000', headerText: '#ffffff',
      tableHeadBg: '#ffffff', tableHeadText: '#000000',
      stripeBg: '#ffffff', accentColor: '#000000',
      borderColor: '#000000',
    },
  };
  return themes[theme] || themes.standard;
}
