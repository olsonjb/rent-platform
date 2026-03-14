const resolveAppOrigin = (): string | null => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof configured === "string" && configured.length > 0) return configured;

  const vercelUrl = process.env.VERCEL_URL;
  if (typeof vercelUrl === "string" && vercelUrl.length > 0) return `https://${vercelUrl}`;

  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:3000";

  return null;
};

const getWorkerSecret = (): string | null => {
  const secret = process.env.APPLICATION_SCREENING_WORKER_SECRET ?? process.env.CRON_SECRET;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
};

async function triggerApplicationScreeningProcessing(): Promise<void> {
  const origin = resolveAppOrigin();
  const secret = getWorkerSecret();

  if (!origin || !secret) return;

  const url = new URL("/api/internal/application-screenings/process", origin);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Application screening processing request failed with ${response.status}`);
  }
}

export function triggerApplicationScreeningProcessingInBackground(): void {
  void triggerApplicationScreeningProcessing().catch((error: unknown) => {
    console.error("Failed to trigger application screening processing", error);
  });
}
