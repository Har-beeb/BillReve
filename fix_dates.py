with open('client/src/pages/PublicInvoice.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'invoice.dueDate &&', 
    '(invoice.due_date || invoice.dueDate) &&'
).replace(
    'new Date(invoice.dueDate)', 
    'new Date(invoice.due_date || invoice.dueDate)'
)

with open('client/src/pages/PublicInvoice.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

with open('client/src/pages/PublicQuote.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'quote.createdAt && (',
    '(quote.expires_at || quote.expiresAt) && ('
).replace(
    'themeStyles.accentText}">Date</p>',
    'themeStyles.accentText}">Valid Until</p>'
).replace(
    'new Date(quote.createdAt)',
    'new Date(quote.expires_at || quote.expiresAt)'
)

with open('client/src/pages/PublicQuote.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
