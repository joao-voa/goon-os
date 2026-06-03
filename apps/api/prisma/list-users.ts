import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, allowedModules: true, mustChangePassword: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  console.log(`Total ativos: ${users.length}\n`)
  for (const u of users) {
    const mods = u.allowedModules ? (() => { try { return JSON.parse(u.allowedModules!) } catch { return [u.allowedModules] }})() : null
    const modsLabel = Array.isArray(mods) ? (mods.length > 5 ? `${mods.length} módulos` : mods.join(',')) : '—'
    console.log(`  ${u.name.padEnd(28)} ${u.email.padEnd(35)} ${u.role.padEnd(10)} mods=${modsLabel}  ${u.mustChangePassword ? '🔑' : ''}`)
  }
}
main().finally(() => prisma.$disconnect())
