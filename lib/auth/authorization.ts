import type { UserRoles, UserType } from "@/lib/auth/user-types";

const ROLE_ROUTE_PREFIXES: Record<UserType, readonly string[]> = {
  landlord: ["/landlord"],
  renter: ["/renter"],
};

const USER_HOME_ROUTES: Record<UserType, string> = {
  landlord: "/landlord/dashboard",
  renter: "/renter/dashboard",
};

const pathMatchesPrefix = (pathname: string, prefix: string) => {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

export const getRequiredUserTypeForPath = (pathname: string): UserType | null => {
  for (const userType of Object.keys(ROLE_ROUTE_PREFIXES) as UserType[]) {
    const prefixes = ROLE_ROUTE_PREFIXES[userType];

    if (prefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
      return userType;
    }
  }

  return null;
};

export const getHomeRouteForUserType = (userType: UserType): string => {
  return USER_HOME_ROUTES[userType];
};

export const getHomeRouteForUserRoles = (roles: UserRoles): string => {
  const [firstRole] = roles;
  return firstRole ? getHomeRouteForUserType(firstRole) : "/protected";
};

export const canAccessPathForUserType = (pathname: string, userType: UserType): boolean => {
  const requiredUserType = getRequiredUserTypeForPath(pathname);

  if (!requiredUserType) {
    return true;
  }

  return requiredUserType === userType;
};

export const canAccessPathForUserRoles = (pathname: string, roles: UserRoles): boolean => {
  const requiredUserType = getRequiredUserTypeForPath(pathname);

  if (!requiredUserType) {
    return true;
  }

  return roles.includes(requiredUserType);
};
