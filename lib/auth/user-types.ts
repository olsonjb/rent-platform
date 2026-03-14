export const USER_TYPES = ["landlord", "renter"] as const;

export type UserType = (typeof USER_TYPES)[number];
export type UserRoles = UserType[];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  landlord: "Landlord",
  renter: "Renter",
};

type GenericObject = Record<string, unknown>;

const isObject = (value: unknown): value is GenericObject => {
  return typeof value === "object" && value !== null;
};

const hasKey = <TKey extends string>(
  value: unknown,
  key: TKey,
): value is Record<TKey, unknown> => {
  return isObject(value) && key in value;
};

export const isUserType = (value: unknown): value is UserType => {
  return typeof value === "string" && USER_TYPES.includes(value as UserType);
};

const toUserRoles = (values: unknown[]): UserRoles => {
  const uniqueRoles = new Set<UserType>();

  for (const value of values) {
    if (isUserType(value)) {
      uniqueRoles.add(value);
    }
  }

  return [...uniqueRoles];
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

export const getUserRolesFromMetadata = (metadata: unknown): UserRoles => {
  if (!isObject(metadata)) {
    return [];
  }

  if (hasKey(metadata, "roles") && Array.isArray(metadata.roles)) {
    return toUserRoles(metadata.roles);
  }

  const fallbackRole = getUserTypeFromMetadata(metadata);

  return fallbackRole ? [fallbackRole] : [];
};

export const getUserRolesFromClaims = (claims: unknown): UserRoles => {
  if (!isObject(claims)) {
    return [];
  }

  const metadataFromUserClaims = hasKey(claims, "user_metadata")
    ? claims.user_metadata
    : null;
  const metadataFromAppClaims = hasKey(claims, "app_metadata") ? claims.app_metadata : null;

  const combinedRoles = [
    ...getUserRolesFromMetadata(metadataFromUserClaims),
    ...getUserRolesFromMetadata(metadataFromAppClaims),
  ];

  return toUserRoles(combinedRoles);
};

export const getUserTypeFromClaims = (claims: unknown): UserType | null => {
  const [firstRole] = getUserRolesFromClaims(claims);
  return firstRole ?? null;
};
