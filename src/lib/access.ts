import { prisma } from "./prisma";

export type ProjectRole = "owner" | "editor" | "reviewer" | "viewer";

/** Proyek bisa dibuka pemiliknya atau kolaborator yang diundang (ProjectMember). */
export async function getProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!project) return null;
  if (project.ownerId === userId) return { project, role: "owner" as ProjectRole };
  const m = project.members.find((mm) => mm.userId === userId);
  if (!m) return null;
  const role = (["editor", "reviewer", "viewer"].includes(m.role) ? m.role : "reviewer") as ProjectRole;
  return { project, role };
}

export function canScreen(role: ProjectRole) {
  return role === "owner" || role === "editor" || role === "reviewer";
}
export function canManage(role: ProjectRole) {
  return role === "owner" || role === "editor";
}
