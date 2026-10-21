"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Truck,
  RotateCcw,
  ArrowDownLeft,
  Loader2,
  Barcode,
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Coins,
  CreditCard,
  Layers,
} from "lucide-react";
import { saveInvoice } from "./actions";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { useI18n } from "@/lib/i18n-client";
import { formatAmount, formatAmountInput } from "@/lib/number-format";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  stock: string;
  salePrice: string;
  costPrice: string;
  unitId?: string | null;
};

type Party = {
  id: string;
  name: string;
  type: "customer" | "supplier";
};

type Cashbox = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  name: string;
  factor: string;
};

type Line = {
  productId: string;
  name: string;
  unitId?: string;
  unitName?: string;
  unitFactor?: string;
  quantity: string;
  unitPrice: string;
  basePrice?: string;
  minPrice?: string;
};

type InvoiceType = "sale" | "purchase" | "sale_return" | "purchase_return";

type InitialInvoice = {
  id: string;
  type: InvoiceType;
  partyId: string | null;
  cashboxId: string;
  paid: string;
  discount: string;
  tax: string;
  lines: Line[];
};

export function InvoiceForm({
  products,
  parties,
  cashboxes,
  units = [],
  partyBalances = {},
  initial,
}: {
  products: Product[];
  parties: Party[];
  cashboxes: Cashbox[];
  units?: Unit[];
  partyBalances?: Record<string, number>;
  initial?: InitialInvoice;
}) {
  const { t, locale } = useI18n();
  const [type, setType] = useState<InvoiceType>(initial?.type ?? "sale");
  const [productId, setProductId] = useState(initial?.lines[0]?.productId ?? products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<Line[]>(() => (initial?.lines ?? []).map((line) => ({ ...line, unitPrice: formatAmountInput(Number(line.unitPrice)), basePrice: line.basePrice ? formatAmountInput(Number(line.basePrice)) : undefined, minPrice: line.minPrice ? formatAmountInput(Number(line.minPrice)) : undefined })));
  const [discount, setDiscount] = useState(formatAmountInput(Number(initial?.discount ?? 0)));
  const [tax, setTax] = useState(initial?.tax ?? "0");
  const [paid, setPaid] = useState(formatAmountInput(Number(initial?.paid ?? 0)));
  const [partyId, setPartyId] = useState<string>(initial?.partyId ?? "");
  const [cashboxId, setCashboxId] = useState<string>(initial?.cashboxId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [lastUnregisteredBarcode, setLastUnregisteredBarcode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit" | "partial">(() => {
    if (initial) {
      const initialTotal =
        Number(initial.lines.reduce((acc, l) => acc + Number(l.quantity) * Number(l.unitPrice), 0)) -
        Number(initial.discount || 0);
      const initialPaid = Number(initial.paid || 0);
      if (initialPaid >= initialTotal && initialTotal > 0) return "cash";
      if (initialPaid === 0) return "credit";
      return "partial";
    }
    return "cash";
  });

  const availableUnits = useMemo<Unit[]>(() => {
    if (units && units.length > 0) return units;
    return [
      { id: "default-piece", name: "قطعة", factor: "1" },
      { id: "default-carton", name: "كرتونة", factor: "24" },
    ];
  }, [units]);

  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
    const firstProd = products.find((p) => p.id === (initial?.lines[0]?.productId ?? products[0]?.id));
    if (firstProd?.unitId && availableUnits.some((u) => u.id === firstProd.unitId)) {
      return firstProd.unitId;
    }
    const piece = availableUnits.find((u) => Number(u.factor) === 1);
    return piece?.id ?? availableUnits[0]?.id ?? "";
  });

  const selected = products.find((p) => p.id === productId);

  const onProductSelect = (newId: string) => {
    setProductId(newId);
    setFormError(null);
    const p = products.find((prod) => prod.id === newId);
    if (p?.unitId && availableUnits.some((u) => u.id === p.unitId)) {
      setSelectedUnitId(p.unitId);
    }
  };

  const selectedUnit = useMemo(() => {
    return availableUnits.find((u) => u.id === selectedUnitId) || availableUnits[0];
  }, [availableUnits, selectedUnitId]);

  const selectedUnitFactor = Math.max(1, Math.round(Number(selectedUnit?.factor ?? 1)) || 1);
  const isCustomerType = type === "sale" || type === "sale_return";
  const baseSelectedPrice = selected ? Number(isCustomerType ? selected.salePrice : selected.costPrice) : 0;
  const calculatedUnitPrice = formatAmountInput(baseSelectedPrice * selectedUnitFactor);

  // Compute live subtotal
  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = parseFloat(line.quantity) || 0;
      const p = parseFloat(line.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  // Initial discount % from initial props
  const [discountPercent, setDiscountPercent] = useState(() => {
    if (initial?.discount && Number(initial.discount) > 0) {
      const initialSubtotal = (initial.lines ?? []).reduce(
        (sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0),
        0
      );
      if (initialSubtotal > 0) {
        return ((parseFloat(initial.discount) / initialSubtotal) * 100).toFixed(4);
      }
    }
    return "0";
  });

  const parseNum = (str: string): number => {
    if (!str) return 0;
    const normalized = str.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  };

  const onPercentChange = (pctStr: string) => {
    setDiscountPercent(pctStr);
    const pct = parseNum(pctStr);
    if (pct > 0 && subtotal > 0) {
      const calculatedEgp = formatAmountInput(Math.min(subtotal, (subtotal * pct) / 100));
      setDiscount(calculatedEgp);
    } else if (pctStr === "" || pct === 0) {
      setDiscount("0");
    }
  };

  const onDiscountEgpChange = (egpStr: string) => {
    setDiscount(egpStr);
    const egp = parseNum(egpStr);
    if (egp > 0 && subtotal > 0) {
      setDiscountPercent(((egp / subtotal) * 100).toFixed(4));
    } else if (egpStr === "" || egp === 0) {
      setDiscountPercent("0");
    }
  };

  const discountAmount = discountPercent && parseNum(discountPercent) > 0 && subtotal > 0
    ? Math.min(subtotal, (subtotal * parseNum(discountPercent)) / 100)
    : parseNum(discount);

  const total = useMemo(() => {
    const rawLinesTotal = lines.reduce(
      (sum, line) => sum + Math.round(Number(line.quantity) * Number(line.unitPrice) * 100),
      0
    );
    const rawDiscount = Math.round(discountAmount * 100);
    const rawTax = Math.round(Number(tax || 0) * 100);
    return Math.max(0, (rawLinesTotal - rawDiscount + rawTax) / 100);
  }, [lines, discountAmount, tax]);

  const selectedParty = parties.find((party) => party.id === partyId);
  const previousBalance = partyBalances[partyId] ?? 0;

  const effectivePaid = paymentMode === "cash" ? formatAmountInput(total) : paymentMode === "credit" ? "0" : paid;

  // Barcode Fast Scan with Stock Validation
  const handleBarcodeScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = barcodeQuery.trim().toLowerCase();
    if (!trimmed) return;
    const found = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === trimmed) ||
        p.sku.toLowerCase() === trimmed ||
        p.name.toLowerCase() === trimmed
    );
    if (found) {
      onProductSelect(found.id);
      const factor = Number(selectedUnit?.factor ?? 1) || 1;
      const basePrice = Number(isCustomerType ? found.salePrice : found.costPrice);
      const unitPrice = formatAmountInput(basePrice * factor);
      const minPrice = isCustomerType ? formatAmountInput(Number(found.costPrice) * factor) : "0";

      // Stock check for sale and purchase return
      const existingPieces = lines
        .filter((l) => l.productId === found.id)
        .reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitFactor) || 1), 0);
      const availablePieces = Math.floor(Number(found.stock));

      if ((type === "sale" || type === "purchase_return") && existingPieces + factor > availablePieces) {
        setFormError(
          `عفواً، لا يمكن إضافة «${found.name}» لأن رصيد المخزن (${availablePieces} قطعة) غير كافٍ للكمية المطلوبة.`
        );
        setScanFeedback({
          message: `رصيد المخزن غير كافٍ لـ «${found.name}» (المتاح: ${availablePieces} قطعة)`,
          type: "error",
        });
        return;
      }

      setLines((prev) => {
        const existingIndex = prev.findIndex((l) => l.productId === found.id && l.unitId === selectedUnit?.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          const curQty = Math.max(1, parseInt(updated[existingIndex].quantity, 10) || 1);
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: String(curQty + 1),
          };
          return updated;
        }
        return [
          ...prev,
          {
            productId: found.id,
            name: found.name,
            unitId: selectedUnit?.id,
            unitName: selectedUnit?.name,
            unitFactor: String(factor),
            quantity: "1",
            unitPrice,
            basePrice: String(basePrice),
            minPrice,
          },
        ];
      });
      setBarcodeQuery("");
      setLastUnregisteredBarcode(null);
      setFormError(null);
      setScanFeedback({ message: `تمت إضافة «${found.name}» إلى الفاتورة بنجاح`, type: "success" });
      setTimeout(() => setScanFeedback(null), 3500);
    } else {
      setLastUnregisteredBarcode(trimmed);
      setScanFeedback({
        message: `الباركود «${trimmed}» غير مسجل في المخزن حالياً`,
        type: "error",
      });
    }
  };

  const partyList = parties.filter((p) => p.type === (isCustomerType ? "customer" : "supplier"));

  // Add line to invoice with integer validation, stock validation, and price safety
  function addLine() {
    if (!selected) {
      setFormError("يرجى اختيار صنف أولاً لإضافته إلى الفاتورة.");
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError("الكمية يجب أن تكون عدداً صحيحاً موجباً (1 أو أكثر).");
      return;
    }

    const factor = selectedUnitFactor;
    const piecesToAdd = qty * factor;
    const availableStock = Math.floor(Number(selected.stock));

    // Calculate how many pieces of this product are already in the invoice
    const existingInCartPieces = lines
      .filter((l) => l.productId === selected.id)
      .reduce((sum, l) => sum + (parseInt(l.quantity, 10) || 0) * (Number(l.unitFactor) || 1), 0);

    const totalRequiredPieces = existingInCartPieces + piecesToAdd;

    if (type === "sale" && totalRequiredPieces > availableStock) {
      setFormError(
        `الكمية المطلوبة (${totalRequiredPieces} قطعة) تتجاوز الرصيد المتوفر في المخزن (${availableStock} قطعة) للصنف «${selected.name}».`
      );
      return;
    }

    if (type === "purchase_return" && totalRequiredPieces > availableStock) {
      setFormError(
        `لا يمكن عمل مرتجع مشتريات بكمية (${totalRequiredPieces} قطعة) تتجاوز المتوفر في المخزن (${availableStock} قطعة).`
      );
      return;
    }

    const price = calculatedUnitPrice;
    const unitName = selectedUnit?.name ?? "قطعة";
    const minPrice = isCustomerType ? formatAmountInput(Number(selected.costPrice) * factor) : "0";

    setLines((old) => [
      ...old,
      {
        productId: selected.id,
        name: selected.name,
        unitId: selectedUnit?.id,
        unitName,
        unitFactor: String(factor),
        quantity: String(qty),
        unitPrice: price,
        basePrice: String(baseSelectedPrice),
        minPrice,
      },
    ]);
    setQuantity("1");
    setFormError(null);
  }

  // Update Line Quantity with Integer Stepper and Stock Protection
  const updateLineQuantity = (index: number, newQtyStr: string) => {
    const qty = parseInt(newQtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError("الكمية يجب أن تكون عدداً صحيحاً موجباً (1 أو أكثر).");
      return;
    }

    const target = lines[index];
    const factor = Number(target.unitFactor) || 1;
    const prod = products.find((p) => p.id === target.productId);
    const availableStock = Math.floor(Number(prod?.stock ?? 0));

    const otherLinesPieces = lines
      .filter((l, i) => i !== index && l.productId === target.productId)
      .reduce((sum, l) => sum + (parseInt(l.quantity, 10) || 0) * (Number(l.unitFactor) || 1), 0);

    const totalPieces = otherLinesPieces + qty * factor;

    if ((type === "sale" || type === "purchase_return") && totalPieces > availableStock) {
      setFormError(
        `الكمية المطلوبة (${totalPieces} قطعة) تتجاوز المتوفر في المخزن (${availableStock} قطعة) للصنف: ${target.name}`
      );
      return;
    }

    setFormError(null);
    setLines((old) => old.map((item, i) => (i === index ? { ...item, quantity: String(qty) } : item)));
  };

  // Update Line Unit Price with Protection Against Selling Below Unit/Cost Price
  const updateLinePrice = (index: number, newPriceStr: string) => {
    const newPrice = parseFloat(newPriceStr);
    const target = lines[index];
    const factor = Number(target.unitFactor) || 1;
    const minAllowed = parseFloat(target.minPrice ?? "0");

    if (type === "sale") {
      // Selling price protection: Do not allow selling below unit cost or official unit price
      if (isNaN(newPrice) || newPrice < minAllowed - 0.005) {
        setFormError(
          `ممنوع البيع بسعر أقل من سعر التكلفة/الحد الأدنى للوحدة (${formatAmount(minAllowed)} ج.م). لتطبيق تخفيض يرجى استخدام خانة الخصم الرسمية.`
        );
        return;
      }
    } else if (isNaN(newPrice) || newPrice < 0) {
      setFormError("سعر الوحدة يجب أن يكون رقماً موجباً.");
      return;
    }

    setFormError(null);
    setLines((old) => old.map((item, i) => (i === index ? { ...item, unitPrice: newPriceStr } : item)));
  };

  // Full Pre-Submit Validation of Worst-Case Scenarios
  const handleAction = async (formData: FormData) => {
    setFormError(null);
    formData.set("discount", discountAmount.toFixed(2));
    formData.set("paid", effectivePaid);

    // 1. Must have lines
    if (lines.length === 0) {
      setFormError("لا يمكن حفظ فاتورة فارغة. يرجى إضافة صنف واحد على الأقل.");
      return;
    }

    // 2. Quantity checks on all lines
    for (const line of lines) {
      const q = parseInt(line.quantity, 10);
      if (isNaN(q) || q <= 0) {
        setFormError(`الكمية غير صالحة للصنف «${line.name}». يجب أن تكون 1 أو أكثر.`);
        return;
      }
      const p = parseFloat(line.unitPrice);
      if (isNaN(p) || p < 0) {
        setFormError(`سعر غير صالح للصنف «${line.name}».`);
        return;
      }
      if (type === "sale" && p < parseFloat(line.minPrice ?? "0") - 0.005) {
        setFormError(
          `لا يمكن البيع بأقل من سعر التكلفة المعتمد للصنف «${line.name}» (${line.minPrice} ج.م).`
        );
        return;
      }
    }

    // 3. Overall stock check for all products combined
    if (type === "sale" || type === "purchase_return") {
      const neededByProduct = new Map<string, number>();
      for (const line of lines) {
        const factor = Number(line.unitFactor) || 1;
        const pieces = parseInt(line.quantity, 10) * factor;
        neededByProduct.set(line.productId, (neededByProduct.get(line.productId) ?? 0) + pieces);
      }
      for (const [pId, needed] of neededByProduct) {
        const prod = products.find((p) => p.id === pId);
        const stock = Math.floor(Number(prod?.stock ?? 0));
        if (needed > stock) {
          setFormError(
            `عفواً، الكمية الإجمالية المطلوبة للصنف «${prod?.name ?? pId}» (${needed} قطعة) تتجاوز رصيد المخزن المتاح (${stock} قطعة).`
          );
          return;
        }
      }
    }

    // 4. Credit / Anonymous Customer Safeguard
    const paidNum = parseNum(effectivePaid);
    if (paidNum < total && !partyId) {
      setFormError(
        "لا يمكن البيع بالآجل أو تسجيل مديونية لعميل نقدي مجهول. يرجى اختيار عميل مسجل لترحيل المديونية لحسابه."
      );
      return;
    }

    // 5. Cashbox Requirement when paying cash
    if (paidNum > 0 && !cashboxId) {
      setFormError("يرجى اختيار الصندوق / الخزينة عند تحصيل أو سداد مبالغ نقدية.");
      return;
    }

    // 6. Paid cannot exceed final total
    if (paidNum > total) {
      setFormError(`المبلغ المدفوع (${paidNum} ج.م) لا يمكن أن يتجاوز إجمالي الفاتورة الصافي (${total} ج.م).`);
      return;
    }

    // 7. Discount cannot exceed subtotal
    const discountNum = discountAmount;
    if (discountNum > subtotal) {
      setFormError("قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة قبل الخصم.");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveInvoice(formData);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("INSUFFICIENT_STOCK")) {
        const item = msg.split(":")[1]?.trim() || "";
        setFormError(`عفواً، الكمية المطلوبة غير متوفرة في رصيد المستودع للصنف: ${item}`);
      } else if (msg.includes("ANONYMOUS_CREDIT_NOT_ALLOWED")) {
        setFormError("لا يمكن تسجيل مديونية آجلة لعميل صالة مجهول. يرجى اختيار عميل مسجل.");
      } else if (msg.includes("PRICE_BELOW_COST")) {
        const parts = msg.split(":");
        const name = parts[1] || "";
        const minCost = parts[2] || "";
        setFormError(`ممنوع البيع بسعر أقل من سعر التكلفة المعتمد للصنف «${name}» (${minCost} ج.م).`);
      } else if (msg.includes("AMOUNT_OUT_OF_RANGE")) {
        setFormError("المبلغ المدفوع أو قيمة الخصم تتجاوز إجمالي الفاتورة المسموح به.");
      } else if (msg.includes("CASHBOX_REQUIRED")) {
        setFormError("يرجى اختيار الصندوق / الخزينة عند تحصيل أو سداد نقدية.");
      } else if (msg.includes("PARTY_TYPE_MISMATCH")) {
        setFormError("نوع الطرف المختار لا يطابق نوع الفاتورة.");
      } else {
        setFormError(`تعذر حفظ الفاتورة: ${msg}`);
      }
    }
  };

  return (
    <form action={handleAction} className="invoice-form space-y-4">
      {/* Error Banner with prominent alert styling */}
      {formError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in" role="alert">
          <ShieldAlert size={18} className="shrink-0 text-rose-600" />
          <span className="flex-1">{formError}</span>
        </div>
      )}

      {initial && (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="type" value={type} />
          <CloseDisclosureButton title="تعديل بيانات الفاتورة" />
        </>
      )}

      {/* Hidden serialization of invoice lines */}
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map(({ productId: id, quantity: qty, unitPrice, unitName, unitFactor }) => ({
            productId: id,
            quantity: qty,
            unitPrice,
            unitName,
            unitFactor,
          }))
        )}
      />

      {/* Header controls: Invoice Type, Party, Cashbox */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl shadow-xs">
        {!initial ? (
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
              {locale === "en" ? "Commercial Operation Type:" : "نوع العملية التجارية:"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[var(--panel)] border border-[var(--input-border)] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setType("sale");
                  setFormError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  type === "sale"
                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
                }`}
              >
                <ShoppingCart size={15} />
                <span>{t("invoices.sale", "فاتورة بيع")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("purchase");
                  setFormError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  type === "purchase"
                    ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
                }`}
              >
                <Truck size={15} />
                <span>{t("invoices.purchase", "فاتورة شراء")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("sale_return");
                  setFormError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  type === "sale_return"
                    ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
                }`}
              >
                <RotateCcw size={15} />
                <span>{t("invoices.saleReturn", "مرتجع مبيعات")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("purchase_return");
                  setFormError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  type === "purchase_return"
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
                }`}
              >
                <ArrowDownLeft size={15} />
                <span>{t("invoices.purchaseReturn", "مرتجع مشتريات")}</span>
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
          </div>
        ) : (
          <div>
            <span className="block text-xs font-bold text-[var(--ink)] mb-1.5">{t("invoices.colType", "النوع")}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)]">
              {type === "sale"
                ? t("invoices.sale", "فاتورة بيع")
                : type === "purchase"
                ? t("invoices.purchase", "فاتورة شراء")
                : type === "sale_return"
                ? t("invoices.saleReturn", "مرتجع مبيعات")
                : t("invoices.purchaseReturn", "مرتجع مشتريات")}
            </span>
          </div>
        )}

        {/* Party Selector */}
        <div className={initial ? "" : "md:col-span-1"}>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
            {isCustomerType ? t("invoices.customer", "العميل المستفيد") : t("invoices.supplier", "المورد / شركة التوريد")}
          </label>
          <select
            name="partyId"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setFormError(null);
            }}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2.5 text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">
              {isCustomerType
                ? (locale === "en" ? "Walk-in Cash Customer (No Account)" : "عميل صالة نقدي (كاش فقط)")
                : (locale === "en" ? "Cash Vendor (No Account)" : "مورد نقدي بدون حساب")}
            </option>
            {partyList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedParty && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs" aria-live="polite">
              <span className="font-semibold text-slate-700">{locale === "en" ? "Previous account balance" : "الحساب السابق"}</span>
              <strong className="font-mono text-indigo-800" dir="ltr">{formatAmount(Math.abs(previousBalance))} {t("common.egp", "ج.م")}</strong>
              <span className="text-slate-600">
                {previousBalance === 0
                  ? (locale === "en" ? "Settled" : "لا يوجد رصيد سابق")
                  : selectedParty.type === "customer"
                    ? previousBalance > 0
                      ? (locale === "en" ? "Due from customer" : "مستحق لنا على العميل")
                      : (locale === "en" ? "Customer credit" : "رصيد دائن للعميل")
                    : previousBalance < 0
                      ? (locale === "en" ? "Due to supplier" : "مستحق للمورد")
                      : (locale === "en" ? "Supplier credit" : "رصيد دائن للمورد")}
              </span>
            </div>
          )}
        </div>

        {/* Cashbox Selector */}
        <div className={initial ? "" : "md:col-span-2"}>
          <label className="block text-xs font-bold text-[var(--ink)] mb-1.5">
            {type === "sale"
              ? (locale === "en" ? "Cashbox / Treasury (Cash Inflow)" : "الصندوق / الخزينة (تحصيل نقدية)")
              : type === "sale_return"
              ? (locale === "en" ? "Cashbox / Treasury (Refund to Customer)" : "الصندوق / الخزينة (صرف المرتجع نقداً للعميل)")
              : type === "purchase"
              ? (locale === "en" ? "Cashbox / Treasury (Payment to Vendor)" : "الصندوق / الخزينة (سداد المشتريات نقداً للمورد)")
              : (locale === "en" ? "Cashbox / Treasury (Vendor Refund Inflow)" : "الصندوق / الخزينة (استلام نقدية المرتجع من المورد)")}
          </label>
          <select
            name="cashboxId"
            value={cashboxId}
            onChange={(e) => {
              setCashboxId(e.target.value);
              setFormError(null);
            }}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2.5 text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">{t("invoices.chooseCashbox", "اختر صندوقاً (مطلوب عند تحصيل / دفع نقدية)")}</option>
            {cashboxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barcode & QR Code Fast Scanner Bar */}
      <div className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Barcode size={16} className={`absolute ${locale === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none`} />
            <input
              type="text"
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeScan();
                }
              }}
              placeholder={t("invoices.barcodePrompt", "امسح الباركود / QR بالماسح أو اكتب الكود واضغط Enter...")}
              className={`w-full ${locale === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg font-mono focus:border-[var(--primary)] font-semibold`}
            />
          </div>
          <button
            type="button"
            onClick={() => handleBarcodeScan()}
            className="primary px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <QrCode size={14} />
            <span>{t("invoices.scanAdd", "مسح وإضافة")}</span>
          </button>
        </div>

        {scanFeedback && (
          <div
            className={`text-xs font-bold px-3 py-2 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in ${
              scanFeedback.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {scanFeedback.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{scanFeedback.message}</span>
            </div>
            {scanFeedback.type === "error" && lastUnregisteredBarcode && (
              <a
                href={`/inventory?newBarcode=${encodeURIComponent(lastUnregisteredBarcode)}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 shadow-xs transition-colors shrink-0"
                title={locale === "en" ? "Open inventory to register this barcode" : "فتح صفحة المخزن لإضافة هذا الصنف مباشرة"}
              >
                <span>{locale === "en" ? "Add as New Product" : "إضافة كصنف جديد في المخزن"}</span>
                <ArrowRight size={12} className={locale === "ar" ? "rotate-180" : ""} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Product Selector, Unit Selector and Line Adder */}
      <div className="line-adder grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl items-end shadow-xs">
        <label className="md:col-span-5">
          <span className="block text-xs font-bold text-[var(--ink)] mb-1.5">{t("invoices.selectProduct", "اختيار الصنف")}</span>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)]"
            value={productId}
            onChange={(e) => onProductSelect(e.target.value)}
          >
            {products.map((p) => {
              const price = isCustomerType ? p.salePrice : p.costPrice;
              const stockPieces = Math.floor(Number(p.stock));
              return (
                <option key={p.id} value={p.id}>
                  {p.name} — ({locale === "en" ? `Available: ${stockPieces} pcs` : `المتاح: ${stockPieces} قطعة`}) · {formatAmount(price)} {t("common.egp", "ج.م")}
                </option>
              );
            })}
          </select>
        </label>

        <label className="md:col-span-3">
          <span className="flex items-center justify-between text-xs font-bold text-[var(--ink)] mb-1.5">
            <span>{t("invoices.unitPackage", "الوحدة / التعبئة")}</span>
            {selectedUnitFactor > 1 && (
              <span className="text-[10px] text-indigo-700 font-bold">
                {selectedUnitFactor} {t("common.pieces", "قطع بالعبوة")}
              </span>
            )}
          </span>
          <select
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)]"
            value={selectedUnit?.id ?? ""}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            {availableUnits.map((u) => {
              const f = Math.round(Number(u.factor)) || 1;
              return (
                <option key={u.id} value={u.id}>
                  {u.name} {f > 1 ? `(${f} ${locale === "en" ? "pcs" : "قطعة"})` : `(1 ${locale === "en" ? "pc" : "قطعة"})`}
                </option>
              );
            })}
          </select>
        </label>

        {/* Integer Stepper Quantity (Increments by 1, 2, 3...) */}
        <div className="md:col-span-2">
          <span className="block text-xs font-bold text-[var(--ink)] mb-1.5 text-center">
            {t("invoices.quantity", "الكمية")} ({selectedUnit?.name ?? (locale === "en" ? "Piece" : "قطعة")})
          </span>
          <div className="flex items-center rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(quantity, 10) || 1;
                if (cur > 1) setQuantity(String(cur - 1));
              }}
              className="w-8 h-[34px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer shrink-0 font-bold text-sm"
              title={locale === "en" ? "Decrement quantity by 1" : "إنقاص الكمية بواحد"}
            >
              <Minus size={13} />
            </button>
            <input
              className="w-full text-center font-bold bg-transparent border-0 focus:outline-none text-sm font-mono"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => {
                const val = e.target.value;
                setQuantity(val);
              }}
            />
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(quantity, 10) || 1;
                setQuantity(String(cur + 1));
              }}
              className="w-8 h-[34px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer shrink-0 font-bold text-sm"
              title={locale === "en" ? "Increment quantity by 1" : "زيادة الكمية بواحد"}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col justify-end">
          {selected && (
            <div className="text-[11px] text-[var(--muted)] text-center mb-1 font-bold">
              {calculatedUnitPrice} {t("common.egp", "ج.م")} / {selectedUnit?.name ?? (locale === "en" ? "pc" : "قطعة")}
            </div>
          )}
          <button
            type="button"
            className="primary flex items-center justify-center gap-1.5 h-[38px] px-4 font-bold w-full cursor-pointer"
            onClick={addLine}
          >
            <Plus size={15} />
            <span>{t("invoices.addLine", "إضافة للبند")}</span>
          </button>
        </div>
      </div>

      {/* Items Desktop Table (>= 768px) */}
      <div className="desktop-table-only table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-4/12">{t("invoices.item", "الصنف")}</th>
              <th className="w-2/12 text-center">{t("invoices.unitPackage", "الوحدة والتعبئة")}</th>
              <th className="w-2/12 text-center">{t("invoices.quantity", "الكمية")}</th>
              <th className="w-2/12 text-center">{t("invoices.unitPrice", "سعر الوحدة")}</th>
              <th className="w-2/12 text-center">{t("invoices.total", "الإجمالي")}</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineTotal = (Number(line.quantity) * Number(line.unitPrice)).toFixed(2);
              const factor = Math.round(Number(line.unitFactor ?? 1)) || 1;
              const totalPieces = (parseInt(line.quantity, 10) || 0) * factor;

              return (
                <tr key={`${line.productId}-${index}`} className="transition-colors">
                  <td className="font-bold text-[var(--ink)]">
                    <div>{line.name}</div>
                    {factor > 1 && (
                      <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">
                        عبوة: {line.unitName ?? "كرتونة"} ({factor} قطعة)
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    <select
                      aria-label="الوحدة والتعبئة"
                      className="table-input text-xs font-bold w-full max-w-[130px] mx-auto py-1 px-1.5 text-center"
                      value={line.unitId ?? ""}
                      onChange={(e) => {
                        const newUnitId = e.target.value;
                        const newUnit = availableUnits.find((u) => u.id === newUnitId);
                        const newFactor = Math.round(Number(newUnit?.factor ?? 1)) || 1;
                        const baseP = Number(
                          line.basePrice ||
                            Number(line.unitPrice) / (Number(line.unitFactor) || 1)
                        );
                        const newPrice = formatAmountInput(baseP * newFactor);
                        const prod = products.find((p) => p.id === line.productId);
                        const minP = isCustomerType ? formatAmountInput(Number(prod?.costPrice ?? 0) * newFactor) : "0";

                        setLines((old) =>
                          old.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  unitId: newUnit?.id,
                                  unitName: newUnit?.name ?? "قطعة",
                                  unitFactor: String(newFactor),
                                  unitPrice: newPrice,
                                  basePrice: String(baseP),
                                  minPrice: minP,
                                }
                              : item
                          )
                        );
                      }}
                    >
                      {availableUnits.map((u) => {
                        const f = Math.round(Number(u.factor)) || 1;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} {f > 1 ? `(${f} ق)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td>
                    {/* Integer Step Controls for Line Quantity */}
                    <div className="flex items-center justify-center gap-1 mx-auto max-w-[110px]">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(line.quantity, 10) || 1;
                          if (cur > 1) updateLineQuantity(index, String(cur - 1));
                        }}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer font-bold"
                        title="إنقاص الكمية بواحد"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        aria-label="الكمية"
                        className="table-input w-14 text-center font-bold font-mono py-1"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(index, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(line.quantity, 10) || 1;
                          updateLineQuantity(index, String(cur + 1));
                        }}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer font-bold"
                        title="زيادة الكمية بواحد"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    {factor > 1 && (
                      <span className="block text-center text-[10px] text-[var(--muted)] font-mono font-bold mt-0.5">
                        (= {totalPieces} قطعة)
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="text-center">
                      {type === "sale" ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-bold text-sm text-[var(--ink)] px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md">
                            {formatAmount(line.unitPrice)} ج.م
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold mt-0.5">
                            سعر الوحدة المعتمد
                          </span>
                        </div>
                      ) : (
                        <input
                          aria-label="سعر الوحدة"
                          className="table-input w-24 text-center font-bold mx-auto font-mono"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLinePrice(index, e.target.value)}
                        />
                      )}
                      {factor > 1 && (
                        <span className="block text-[10px] text-[var(--muted)] mt-0.5 font-mono">
                          ({formatAmount(Number(line.unitPrice) / factor)} ج/قطعة)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="font-bold text-[var(--ink)] text-center font-mono text-sm">
                    {formatAmount(lineTotal)} ج.م
                  </td>
                  <td className="text-center">
                    <button
                      className="danger-link p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      type="button"
                      title="حذف هذا البند من الفاتورة"
                      onClick={() => setLines((old) => old.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty py-8 text-center text-[var(--muted)]">
                  {t("invoices.emptyLines", "لم يتم إضافة أصناف بعد. اختر المنتج والوحدة والكمية أعلاه لإضافته إلى الفاتورة.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Items Mobile Card List (< 768px) */}
      <div className="mobile-cards-only space-y-3">
        {lines.length > 0 ? (
          lines.map((line, index) => {
            const lineTotal = (Number(line.quantity) * Number(line.unitPrice)).toFixed(2);
            const factor = Math.round(Number(line.unitFactor ?? 1)) || 1;
            const totalPieces = (parseInt(line.quantity, 10) || 0) * factor;

            return (
              <div
                key={`${line.productId}-${index}`}
                className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-3"
              >
                {/* Header: Name + Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <b className="text-xs font-bold text-[var(--ink)] block truncate">
                      {line.name}
                    </b>
                    {factor > 1 && (
                      <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">
                        عبوة: {line.unitName ?? "كرتونة"} ({factor} قطعة)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                    title="حذف هذا البند"
                    onClick={() => setLines((old) => old.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Controls: Unit Dropdown + Quantity Stepper */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--line)]/60">
                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-bold block mb-1">
                      الوحدة / التعبئة:
                    </label>
                    <select
                      aria-label="الوحدة والتعبئة"
                      className="w-full bg-[var(--bg)] border border-[var(--line-strong)] rounded-lg py-1.5 px-2 text-xs font-bold text-center"
                      value={line.unitId ?? ""}
                      onChange={(e) => {
                        const newUnitId = e.target.value;
                        const newUnit = availableUnits.find((u) => u.id === newUnitId);
                        const newFactor = Math.round(Number(newUnit?.factor ?? 1)) || 1;
                        const baseP = Number(
                          line.basePrice ||
                            Number(line.unitPrice) / (Number(line.unitFactor) || 1)
                        );
                        const newPrice = formatAmountInput(baseP * newFactor);
                        const prod = products.find((p) => p.id === line.productId);
                        const minP = isCustomerType ? formatAmountInput(Number(prod?.costPrice ?? 0) * newFactor) : "0";

                        setLines((old) =>
                          old.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  unitId: newUnit?.id,
                                  unitName: newUnit?.name ?? "قطعة",
                                  unitFactor: String(newFactor),
                                  unitPrice: newPrice,
                                  basePrice: String(baseP),
                                  minPrice: minP,
                                }
                              : item
                          )
                        );
                      }}
                    >
                      {availableUnits.map((u) => {
                        const f = Math.round(Number(u.factor)) || 1;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} {f > 1 ? `(${f} ق)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[var(--muted)] font-bold block mb-1 text-center">
                      الكمية ({totalPieces} ق):
                    </label>
                    <div className="flex items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(line.quantity, 10) || 1;
                          if (cur > 1) updateLineQuantity(index, String(cur - 1));
                        }}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer font-bold"
                        title="إنقاص الكمية"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        aria-label="الكمية"
                        className="w-full text-center font-bold font-mono py-1 text-xs bg-transparent border-0"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(index, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseInt(line.quantity, 10) || 1;
                          updateLineQuantity(index, String(cur + 1));
                        }}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer font-bold"
                        title="زيادة الكمية"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Price and Subtotal */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]/60 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">سعر الوحدة:</span>
                    <span className="font-mono font-bold text-[var(--ink)]">
                      {formatAmount(line.unitPrice)} ج.م
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-[var(--muted)] block">إجمالي البند:</span>
                    <b className="font-mono font-black text-sm text-indigo-700">
                      {formatAmount(lineTotal)} ج.م
                    </b>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center bg-[var(--panel)] border border-[var(--line)] rounded-xl text-[var(--muted)] text-xs">
            {t("invoices.emptyLines", "لم يتم إضافة أصناف بعد. اختر المنتج والوحدة والكمية أعلاه لإضافته إلى الفاتورة.")}
          </div>
        )}
      </div>

      {/* Financial Summary & Payment Calculations */}
      <div className="totals-inputs grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl shadow-xs">
        {/* Payment Type Toggle Strip */}
        <div className="sm:col-span-3 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--ink)]">{t("invoices.paymentMethod", "طريقة السداد:")}</span>
            <div className="inline-flex p-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentMode("cash")}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 font-bold ${
                  paymentMode === "cash"
                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <Coins size={13} />
                <span>{t("invoices.cash", "كاش (نقدي كامل)")}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("credit")}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 font-bold ${
                  paymentMode === "credit"
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <CreditCard size={13} />
                <span>{t("invoices.credit", "آجل (على الحساب)")}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("partial")}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 font-bold ${
                  paymentMode === "partial"
                    ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <Layers size={13} />
                <span>{t("invoices.partial", "سداد جزئي (عربون / دفعة)")}</span>
              </button>
            </div>
          </div>

          <div className="text-left text-xs font-bold">
            {paymentMode === "cash" ? (
              <span className="text-emerald-700">{t("invoices.cashDesc", "سداد الفاتورة بالكامل نقداً في الخزينة")}</span>
            ) : paymentMode === "credit" ? (
              <span className="text-rose-600">{t("invoices.creditDesc", "تسجيل كامل الفاتورة كمديونية آجلة على الحساب")}</span>
            ) : (
              <span className="text-indigo-700">{t("invoices.partialDesc", "تحصيل دفعة نقدية وترحيل الباقي في الذمة")}</span>
            )}
          </div>
        </div>

        <label>
          <span className="flex items-center justify-between">
            <span className="font-bold text-xs text-[var(--ink)]">{t("invoices.discountPercent", "الخصم (%)")}</span>
            {subtotal > 0 && <small className="text-[var(--muted)] text-[10px]">{locale === "en" ? `From ${formatAmount(subtotal)}` : `من ${formatAmount(subtotal)} ج.م`}</small>}
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.0001"
            value={discountPercent === "0" ? "" : discountPercent}
            placeholder="0%"
            className="font-bold font-mono text-xs mt-1"
            onChange={(e) => onPercentChange(e.target.value)}
          />
        </label>

        <label>
          <span className="font-bold text-xs text-[var(--ink)]">{t("invoices.discountEgp", "الخصم بالجنيه (ج.م)")}</span>
          <input
            name="discount"
            type="number"
            min="0"
            max={subtotal || undefined}
            step="0.01"
            value={discountAmount === 0 ? "" : formatAmountInput(discountAmount)}
            placeholder="0"
            className="font-bold font-mono text-xs mt-1"
            onChange={(e) => onDiscountEgpChange(e.target.value)}
          />
        </label>

        {/* Hidden tax field with default 0 */}
        <input type="hidden" name="tax" value="0" />

        <label>
          <span className="flex items-center justify-between font-bold text-xs text-[var(--ink)]">
            <span>{t("invoices.paidCash", "المدفوع نقداً (ج.م)")}</span>
            {total > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPaymentMode("cash");
                  setPaid(formatAmountInput(total));
                }}
                className="text-[10px] text-indigo-700 font-bold hover:underline cursor-pointer"
              >
                {t("invoices.payFull", "سداد كامل")}
              </button>
            )}
          </span>
          <input
            name="paid"
            type="number"
            min="0"
            step="0.01"
            max={total}
            value={effectivePaid === "0" ? "" : effectivePaid}
            placeholder="0"
            className="font-bold font-mono text-xs mt-1"
            onChange={(e) => {
              setPaid(e.target.value);
              const val = Number(e.target.value) || 0;
              if (val >= total && total > 0) setPaymentMode("cash");
              else if (val === 0) setPaymentMode("credit");
              else setPaymentMode("partial");
            }}
          />
        </label>

        <div className="sm:col-span-3 flex items-center justify-between p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block mb-0.5">{t("invoices.subtotal", "المجموع قبل الخصم")}:</span>
            <b className="text-base text-[var(--ink)] font-bold">{formatAmount(subtotal)} {t("common.egp", "ج.م")}</b>
          </div>
          <div className="text-left">
            <span className="text-xs text-[var(--muted)] font-semibold block mb-0.5">{t("invoices.netTotal", "الصافي النهائي المطلوب")}:</span>
            <b className="text-2xl font-black text-indigo-700">{formatAmount(total)} {t("common.egp", "ج.م")}</b>
          </div>
        </div>
      </div>

      {/* Protected Submit Button (Anti-Double-Click & Validation Ready) */}
      <div className="flex justify-end pt-2 w-full">
        <button
          className="primary px-8 py-3.5 text-sm w-full sm:w-auto min-w-[220px] font-black cursor-pointer rounded-xl flex items-center justify-center shadow-md active:scale-98 transition-all"
          type="submit"
          disabled={lines.length === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>{t("invoices.saving", "جاري حفظ وترحيل الفاتورة...")}</span>
            </span>
          ) : (
            <span>
              {initial
                ? t("invoices.saveEdits", "حفظ تعديلات الفاتورة")
                : type === "sale"
                ? t("invoices.submitSale", "حفظ فاتورة البيع وترحيلها")
                : type === "purchase"
                ? t("invoices.submitPurchase", "حفظ فاتورة الشراء والتوريد")
                : type === "sale_return"
                ? t("invoices.submitSaleReturn", "حفظ مرتجع المبيعات وترحيله")
                : t("invoices.submitPurchaseReturn", "حفظ مرتجع المشتريات وترحيله")}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
