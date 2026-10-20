"use client";

import { useMemo } from "react";
import { generateQrMatrix } from "@/lib/qr-generator";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  color?: string;
  bgColor?: string;
}

export function QrCodeView({
  value,
  size = 180,
  className = "",
  color = "#0f172a",
  bgColor = "#ffffff",
}: QrCodeProps) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix.length) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-gray-50 border rounded-lg text-xs text-gray-400"
      >
        تعذر إنشاء رمز QR
      </div>
    );
  }

  const moduleCount = matrix.length;
  // Margin of 2 modules around the QR code
  const margin = 2;
  const totalCount = moduleCount + margin * 2;

  return (
    <div
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-white shadow-sm border border-slate-200 ${className}`}
    >
      <svg
        viewBox={`0 0 ${totalCount} ${totalCount}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className="rounded-lg"
      >
        <rect width={totalCount} height={totalCount} fill={bgColor} />
        {matrix.map((row, y) =>
          row.map((isDark, x) =>
            isDark ? (
              <rect
                key={`${x}-${y}`}
                x={x + margin}
                y={y + margin}
                width={1}
                height={1}
                fill={color}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}
