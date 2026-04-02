'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ROLE_LABELS } from '@/lib/supabase/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LayoutDashboard, FolderKanban, Users, LogOut, ChevronDown, UserCircle, Mail, FolderUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  profile: Profile
}

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinks = [
    {
      href: '/dashboard',
      label: profile.role === 'client' ? 'Mon espace' : 'Tableau de bord',
      icon: LayoutDashboard
    },
    {
      href: '/dossiers',
      label: ['client', 'apporteur'].includes(profile.role) ? 'Mes dossiers' : 'Dossiers',
      icon: FolderKanban
    },
    ...(profile.role === 'admin'
      ? [
          { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
          { href: '/admin/email', label: 'Emails', icon: Mail },
          { href: '/admin/import', label: 'Import', icon: FolderUp },
        ]
      : []),
  ]

  const initiales = `${profile.prenom?.[0] ?? ''}${profile.nom?.[0] ?? ''}`.toUpperCase()

  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #EBEBEB' }} className="sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div style={{ background: '#204ce5', borderRadius: '8px' }} className="w-8 h-8 flex items-center justify-center">
                <span style={{ color: '#fff', fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '14px' }}>CU</span>
              </div>
              <div className="hidden sm:block">
                <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: '15px', color: '#112337' }}>
                  Crédit Unique
                </span>
                <span style={{ fontFamily: 'var(--font-open-sans)', fontSize: '11px', color: '#585e6a', display: 'block', lineHeight: '1', marginTop: '-2px' }}>
                  Gestion des dossiers
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    )}
                    style={{
                      fontFamily: 'var(--font-open-sans)',
                      color: active ? '#204ce5' : '#585e6a',
                      background: active ? '#EEF2FF' : 'transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors outline-none cursor-pointer">
              <Avatar className="h-8 w-8">
                <AvatarFallback style={{ background: '#204ce5', color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-poppins)' }}>
                  {initiales}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600, fontSize: '13px', color: '#112337' }}>
                  {profile.prenom} {profile.nom}
                </p>
                <p style={{ fontFamily: 'var(--font-open-sans)', fontSize: '11px', color: '#585e6a' }}>
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>
              <ChevronDown className="h-4 w-4" style={{ color: '#585e6a' }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <Link href="/profil" style={{ textDecoration: 'none' }}>
                <DropdownMenuItem className="cursor-pointer" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCircle className="h-4 w-4" />
                  Mon profil
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer"
                style={{ color: '#dc2626' }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
