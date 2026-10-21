export function localLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("/uploads/") ? value.replace(/^\/uploads\//, "/api/uploads/") : value;
}
