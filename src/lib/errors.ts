export function friendlyErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi."
) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";

  const message = raw.trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed") ||
    lower.includes("networkerror")
  ) {
    return "Koneksi ke server gagal. Periksa internet Anda lalu coba lagi.";
  }

  if (
    lower.includes("jwt") ||
    lower.includes("session") && lower.includes("expired") ||
    lower.includes("invalid refresh token")
  ) {
    return "Sesi login sudah tidak valid. Silakan login kembali.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lower.includes("unauthorized")
  ) {
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  }

  if (lower.includes("duplicate key")) {
    return "Data yang sama sudah ada. Periksa kembali input Anda.";
  }

  if (lower.includes("timeout")) {
    return "Server terlalu lama merespons. Silakan coba lagi.";
  }

  return message || fallback;
}
