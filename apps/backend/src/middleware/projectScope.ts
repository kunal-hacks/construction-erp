import { AuthRequest } from './auth';
import { prisma } from '../config/database';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Returns the list of project IDs the requesting user is allowed to see.
 *
 * - Admins (SUPER_ADMIN, ADMIN) → returns `undefined`, meaning "no filter, see everything".
 * - Everyone else → returns a string[] (possibly empty) of project IDs they are a
 *   ProjectMember of. Controllers should filter with `{ projectId: { in: ids } }`.
 *
 * IMPORTANT: callers must check `allowedProjectIds === undefined` to distinguish
 * "admin, no filter" from "PM assigned to zero projects" (an empty array, which
 * should correctly return no data rather than accidentally matching everything).
 */
export const getUserProjectIds = async (req: AuthRequest): Promise<string[] | undefined> => {
  const user = req.user!;
  if (ADMIN_ROLES.includes(user.role)) return undefined;

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  return memberships.map((m) => m.projectId);
};