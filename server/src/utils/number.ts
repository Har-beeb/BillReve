export const formatCurrency = (amount: number) => amount.toFixed(2);
export const addVat = (amount: number, vatRate: number) =>
  amount + amount * (vatRate / 100);
