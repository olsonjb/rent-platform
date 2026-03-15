export interface MaintenanceRequest {
  issue: string;
  urgency: "habitability" | "standard";
}

export interface ParsedMaintenanceResponse {
  displayText: string;
  maintenanceRequests: MaintenanceRequest[];
}

const DELIMITER = "|||MAINTENANCE_REQUEST|||";
const END_DELIMITER = "|||END|||";

/**
 * Parse a Claude response for embedded maintenance request blocks.
 *
 * Format:
 *   <display text>|||MAINTENANCE_REQUEST|||{"issue":"...","urgency":"..."}|||END|||
 *
 * Returns the user-visible display text and an array of parsed requests.
 * Malformed or incomplete blocks are silently skipped.
 */
export function parseMaintenanceRequests(
  text: string
): ParsedMaintenanceResponse {
  const firstIdx = text.indexOf(DELIMITER);
  if (firstIdx === -1) {
    return { displayText: text.trim(), maintenanceRequests: [] };
  }

  const displayText = text.slice(0, firstIdx).trim();
  const requests: MaintenanceRequest[] = [];

  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(DELIMITER, searchFrom);
    if (start === -1) break;
    const jsonStart = start + DELIMITER.length;
    const end = text.indexOf(END_DELIMITER, jsonStart);
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
    searchFrom = end + END_DELIMITER.length;
  }

  return { displayText, maintenanceRequests: requests };
}
