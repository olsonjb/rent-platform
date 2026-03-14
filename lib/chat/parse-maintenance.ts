export interface MaintenanceRequest {
  issue: string;
  urgency: "habitability" | "standard";
}

export function parseMaintenanceRequests(
  text: string
): { displayText: string; maintenanceRequests: MaintenanceRequest[] } {
  const delimiter = "|||MAINTENANCE_REQUEST|||";
  const endDelimiter = "|||END|||";

  const firstIdx = text.indexOf(delimiter);
  if (firstIdx === -1) return { displayText: text.trim(), maintenanceRequests: [] };

  const displayText = text.slice(0, firstIdx).trim();
  const requests: MaintenanceRequest[] = [];

  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(delimiter, searchFrom);
    if (start === -1) break;
    const jsonStart = start + delimiter.length;
    const end = text.indexOf(endDelimiter, jsonStart);
    if (end === -1) break;
    const jsonStr = text.slice(jsonStart, end).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.issue && parsed.urgency) {
        requests.push(parsed as MaintenanceRequest);
      }
    } catch {
      // ignore malformed block
    }
    searchFrom = end + endDelimiter.length;
  }

  return { displayText, maintenanceRequests: requests };
}
