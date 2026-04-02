// auth.utils.ts
export function sanitizeUser(user: any) {
  const { passwordHash, deletedAt, ...rest } = user;
  return rest;
}