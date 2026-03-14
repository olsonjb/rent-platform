export const MAINTENANCE_REQUEST_LOCATIONS = [
  "kitchen",
  "bathroom",
  "living-room",
  "bedroom",
  "hvac",
  "other",
] as const;

export type MaintenanceRequestLocation = (typeof MAINTENANCE_REQUEST_LOCATIONS)[number];

export const MAINTENANCE_REQUEST_URGENCIES = ["habitability", "standard"] as const;

export type MaintenanceRequestUrgency = (typeof MAINTENANCE_REQUEST_URGENCIES)[number];

export const MAINTENANCE_REQUEST_ENTRY_PERMISSIONS = ["can-enter", "present-only"] as const;

export type MaintenanceRequestEntryPermission =
  (typeof MAINTENANCE_REQUEST_ENTRY_PERMISSIONS)[number];

export const MAINTENANCE_REQUEST_STATUSES = ["pending", "in_progress", "completed"] as const;

export type MaintenanceRequestStatus = (typeof MAINTENANCE_REQUEST_STATUSES)[number];

export const MAINTENANCE_REQUEST_LOCATION_LABELS: Record<MaintenanceRequestLocation, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  "living-room": "Living room",
  bedroom: "Bedroom",
  hvac: "Heating / cooling",
  other: "Other",
};

export const MAINTENANCE_REQUEST_URGENCY_LABELS: Record<MaintenanceRequestUrgency, string> = {
  habitability: "Habitability",
  standard: "Standard",
};

export const MAINTENANCE_REQUEST_ENTRY_PERMISSION_LABELS: Record<
  MaintenanceRequestEntryPermission,
  string
> = {
  "can-enter": "Can enter with notice",
  "present-only": "Only when I am present",
};

export const MAINTENANCE_REQUEST_STATUS_LABELS: Record<MaintenanceRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
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
