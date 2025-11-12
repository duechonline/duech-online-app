/**
 * Shared role utilities that can be used in both client and server components
 */

/**
 * Get allowed roles for user creation/update based on current user's role
 */
export function getAllowedRoles(userRole: string): string[] {
  if (userRole === 'superadmin') {
    // Superadmins can assign all types of roles
    return ['lexicographer', 'coordinator', 'editor', 'admin', 'superadmin'];
  } else if (userRole === 'admin') {
    // Admins can only assign lexicographer and admin roles
    return ['lexicographer', 'admin', 'coordinator'];
  }
  return [];
}

/**
 * Validate if a role can be assigned by the current user
 */
export function validateRoleAssignment(
  currentUserRole: string,
  targetRole: string
): {
  valid: boolean;
  error?: string;
} {
  const allowedRoles = getAllowedRoles(currentUserRole);

  if (!allowedRoles.includes(targetRole)) {
    return {
      valid: false,
      error: `You are not authorized to assign role '${targetRole}'. Allowed roles: ${allowedRoles.join(', ')}`,
    };
  }

  return { valid: true };
}
