import type { AuthUser, UserRole } from '@/types/auth'

export function isMasterAdmin(user: AuthUser | null) {
  return user?.role === 'master_admin'
}

export function hasRole(user: AuthUser | null, roles: UserRole[]) {
  if (!user) {
    return false
  }

  return roles.includes(user.role)
}

export function hasPermission(user: AuthUser | null, permission: string) {
  if (!user) {
    return false
  }

  return isMasterAdmin(user) || Boolean(user.effective_permissions?.includes(permission))
}

export function canAccessAnyPermission(user: AuthUser | null, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission))
}

export function getRoleDashboardLabel(role?: UserRole) {
  switch (role) {
    case 'master_admin':
      return 'Master Admin'
    case 'staff':
      return 'Staff'
    case 'booster':
      return 'Booster'
    case 'customer':
      return 'Cliente'
    default:
      return 'Usuário'
  }
}
