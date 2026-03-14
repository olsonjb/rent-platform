export const MAINTENANCE_REQUEST_LOCATIONS = [
  "kitchen",
  "bathroom",
  "living-room",
  "bedroom",
  "hvac",
  "other",
] as const;

export type MaintenanceRequestLocation = (typeof MAINTENANCE_REQUEST_LOCATIONS)[number];

export const MAINTENANCE_REQUEST_URGENCIES = ["emergency", "high", "normal"] as const;

export type MaintenanceRequestUrgency = (typeof MAINTENANCE_REQUEST_URGENCIES)[number];

export const MAINTENANCE_REQUEST_ENTRY_PERMISSIONS = ["can-enter", "present-only"] as const;

export type MaintenanceRequestEntryPermission =
  (typeof MAINTENANCE_REQUEST_ENTRY_PERMISSIONS)[number];

export const MAINTENANCE_REQUEST_STATUSES = ["submitted", "in_progress", "resolved"] as const;

export type MaintenanceRequestStatus = (typeof MAINTENANCE_REQUEST_STATUSES)[number];

export const MAINTENANCE_REQUEST_STATUS_LABELS: Record<MaintenanceRequestStatus, string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const isMaintenanceRequestLocation = (
  value: unknown,
): value is MaintenanceRequestLocation => {
  return (
    typeof value === "string" &&
    MAINTENANCE_REQUEST_LOCATIONS.includes(value as MaintenanceRequestLocation)
  );
};

export const isMaintenanceRequestUrgency = (value: unknown): value is MaintenanceRequestUrgency => {
  return (
    typeof value === "string" &&
    MAINTENANCE_REQUEST_URGENCIES.includes(value as MaintenanceRequestUrgency)
  );
};

export const isMaintenanceRequestEntryPermission = (
  value: unknown,
): value is MaintenanceRequestEntryPermission => {
  return (
    typeof value === "string" &&
    MAINTENANCE_REQUEST_ENTRY_PERMISSIONS.includes(value as MaintenanceRequestEntryPermission)
  );
};

export const isMaintenanceRequestStatus = (value: unknown): value is MaintenanceRequestStatus => {
  return (
    typeof value === "string" &&
    MAINTENANCE_REQUEST_STATUSES.includes(value as MaintenanceRequestStatus)
  );
};
