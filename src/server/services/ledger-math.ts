export function cashboxBalance(opening:string, transactions:{kind:string;amount:string}[]) { return transactions.reduce((balance,t)=>balance+(["income","transfer_in","invoice_payment","party_payment"].includes(t.kind)?Number(t.amount):-Number(t.amount)),Number(opening)); }
export function partyBalance(opening: string, entries: { debit: string; credit: string }[], type: "customer" | "supplier" = "customer") {
  return entries.reduce(
    (balance, e) =>
      balance + (type === "customer" ? Number(e.debit) - Number(e.credit) : Number(e.credit) - Number(e.debit)),
    Number(opening)
  );
}
export function invoiceStatus(total:number,paid:number) { if(total<0||paid<0||paid>total)throw new Error("INVALID_AMOUNT");return paid===0?"unpaid":paid===total?"paid":"partial"; }
export function reverseCashKind(kind:string):"income"|"expense"|null { if(["invoice_payment","income","transfer_in","party_payment"].includes(kind)) return "expense"; if(["expense","transfer_out"].includes(kind)) return "income"; return null; }
export function restoreEditedInvoiceStock(currentStock:number,invoiceQuantity:number,type:"sale"|"purchase") { const restored=currentStock+(type==="sale"?invoiceQuantity:-invoiceQuantity); if(restored<0) throw new Error("CANNOT_REVERSE_PURCHASE_STOCK"); return restored; }
