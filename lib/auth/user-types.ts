export const USER_TYPES = ["landlord", "renter"] as const;

export type UserType = (typeof USER_TYPES)[number];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  landlord: "Landlord",
  renter: "Renter",
};

const hasKey = <TKey extends string>(
  value: unknown,
  key: TKey,
): value is Record<TKey, unknown> => {
  return typeof value === "object" && value !== null && key in value;
};

export const isUserType = (value: unknown): value is UserType => {
  return typeof value === "string" && USER_TYPES.includes(value as UserType);
};

export const getUserTypeFromMetadata = (metadata: unknown): UserType | null => {
  if (!hasKey(metadata, "userType") && !hasKey(metadata, "role")) {
    return null;
  }

  const userTypeValue = hasKey(metadata, "userType")
    ? metadata.userType
    : metadata.role;

  return isUserType(userTypeValue) ? userTypeValue : null;
};
