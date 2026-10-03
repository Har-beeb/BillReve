import re

with open('client/src/pages/PublicQuote.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix the detailsGrid in PublicQuote
old_details = """          <div className={`grid grid-cols-2 gap-12 mb-12 ${themeStyles.detailsGrid}`}>
             <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quote For</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right">
               <div className="mb-4">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(quote.created_at).toLocaleDateString()}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                 <p className="font-medium text-slate-900 text-sm">{quote.createdAt ? new Date(quote.expires_at || quote.expiresAt).toLocaleDateString() : 'N/A'}</p>
               </div>
             </div>
          </div>"""

new_details = """          <div className={`grid grid-cols-2 gap-12 p-8 md:px-12 ${themeStyles.detailsGrid}`}>
             <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Quote For</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right flex flex-col items-end gap-4">
               <div>
                 <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(quote.created_at).toLocaleDateString()}</p>
               </div>
               {(quote.expires_at || quote.expiresAt) && (
                 <div>
                   <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Valid Until</p>
                   <p className="font-medium text-slate-900">{new Date(quote.expires_at || quote.expiresAt).toLocaleDateString()}</p>
                 </div>
               )}
             </div>
          </div>"""

if old_details in c:
    c = c.replace(old_details, new_details)
    print("Replaced details grid in quote.")
else:
    print("Could not find details grid in quote!")
    
# Wait, also fix the tableWrapper padding in PublicQuote
old_tableWrapper = '          <div className={`flex-1 ${themeStyles.tableWrapper}`}>'
new_tableWrapper = '          <div className={`flex-1 mx-8 md:mx-12 ${themeStyles.tableWrapper}`}>'
if old_tableWrapper in c:
    c = c.replace(old_tableWrapper, new_tableWrapper)
    print("Replaced table wrapper in quote.")

with open('client/src/pages/PublicQuote.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

# Now for the Monochrome Theme bug (black on black text)
with open('client/src/utils/documentThemes.ts', 'r', encoding='utf-8') as f:
    c2 = f.read()

# Change the totalRow in monochrome to just be a thick black border, with text remaining black
old_monochrome_total = "totalRow: 'border-t-[6px] border-black bg-black text-white',"
new_monochrome_total = "totalRow: 'border-t-[6px] border-black bg-white text-black',"
if old_monochrome_total in c2:
    c2 = c2.replace(old_monochrome_total, new_monochrome_total)
    print("Fixed monochrome totalRow text color")
else:
    print("Could not find monochrome total row")

with open('client/src/utils/documentThemes.ts', 'w', encoding='utf-8') as f:
    f.write(c2)
