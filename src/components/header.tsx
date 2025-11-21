'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/common/button';
import {
  HomeIcon,
  SearchIcon,
  FolderIcon,
  InformationCircleIcon,
  UsersIcon,
  GlobeIcon,
  MenuIcon,
  CloseIcon,
  ArrowRightIcon,
} from '@/components/icons';

// Navigation link component with icon
function NavLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors hover:bg-white/10"
      style={{ color: '#ffffff' }}
    >
      <Icon className="h-5 w-5" />
      <span className="hover:text-yellow-300">{children}</span>
    </Link>
  );
}

interface HeaderProps {
  editorMode: boolean;
  initialUser?: { id: string; name?: string; email: string; role?: string } | null;
}

export default function Header({ editorMode, initialUser = null }: HeaderProps) {
  const pathname = usePathname();
  const editorBasePath = editorMode && pathname.startsWith('/editor') ? '/editor' : '';
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const buildHref = (path: string) => {
    if (!editorMode || !editorBasePath) {
      return path;
    }

    if (path === '/') {
      return editorBasePath;
    }

    return `${editorBasePath}${path}`;
  };

  const [user, setUser] = useState<{ name?: string; email: string; role?: string } | null>(
    initialUser
  );

  const homeLink = buildHref('/');
  const title = editorMode ? 'DUECh Editor' : 'DUECh';
  const subtitle = editorMode
    ? 'Editor del Diccionario de uso del español de Chile'
    : 'Diccionario de uso del español de Chile';

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[Header] Error fetching user:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Sync user state with initialUser prop
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    // Only fetch if we don't have initial user data
    if (!initialUser) {
      fetchUser();
    }
  }, [fetchUser, initialUser]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-dropdown]') && !target.closest('[data-menu-button]')) {
          setIsMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Always redirect to login after logout
      const logoutUrl = `/api/auth/logout?redirect=/login`;

      const response = await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin', // Ensure cookies are sent
      });

      if (response.ok) {
        // Force a full page reload to clear all client state
        window.location.href = '/login';
      } else {
        // If logout fails, still redirect to login
        window.location.href = '/login';
      }
    } catch {
      // On any error, redirect to login
      window.location.href = '/login';
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="bg-duech-blue shadow-lg">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href={homeLink}
              className="hover:text-duech-gold flex items-center gap-4 text-2xl font-bold text-white transition-colors"
            >
              <Image
                src="/logo_medium.png"
                alt="DUECh Logo"
                width={50}
                height={50}
                className="object-contain"
              />
              <div className="hidden sm:block">
                <div className="text-duech-gold">{title}</div>
                <div className="text-xs font-normal text-gray-200">{subtitle}</div>
              </div>
            </Link>
          </div>

          {/* Right side - User info and Menu button */}
          <div className="relative flex items-center gap-3">
            {/* User info and logout - only in editor mode */}
            {editorMode && user && (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-white/80 md:block">
                  {user.name || user.email}
                </span>
                <form onSubmit={handleLogout}>
                  <Button
                    type="submit"
                    className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                  >
                    Cerrar sesión
                  </Button>
                </form>
              </div>
            )}

            {/* Hamburger Menu Button - Always visible */}
            <button
              data-menu-button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-md p-2 text-white transition-colors hover:bg-white/10"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>

            {/* Floating Dropdown Menu */}
            {isMenuOpen && (
              <div
                data-dropdown
                className="bg-duech-blue absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-white/20 py-2 shadow-xl"
              >
                <NavLink href={buildHref('/')} icon={HomeIcon} onClick={closeMenu}>
                  Inicio
                </NavLink>
                <NavLink href={buildHref('/buscar')} icon={SearchIcon} onClick={closeMenu}>
                  Buscar
                </NavLink>
                <NavLink href={buildHref('/recursos')} icon={FolderIcon} onClick={closeMenu}>
                  Recursos
                </NavLink>
                <NavLink
                  href={buildHref('/acerca')}
                  icon={InformationCircleIcon}
                  onClick={closeMenu}
                >
                  Acerca
                </NavLink>
                {editorMode && user && (user.role === 'admin' || user.role === 'superadmin') && (
                  <NavLink href={buildHref('/usuarios')} icon={UsersIcon} onClick={closeMenu}>
                    Gestión de Usuarios
                  </NavLink>
                )}
                {editorMode && (
                  <a
                    href={process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000/'}
                    onClick={closeMenu}
                    className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors hover:bg-white/10"
                    style={{ color: '#ffffff' }}
                  >
                    <GlobeIcon className="h-5 w-5" />
                    <span className="hover:text-yellow-300">Diccionario Público</span>
                  </a>
                )}
                {/* Export redactadas button - only in editor mode */}
                {editorMode && (
                  <Button
                    href="/api/words/reporte-redactadas"
                    className="bg-duech-gold px-1 py-1 mx-5 text-sm font-semibold text-gray-900 shadow-md hover:bg-yellow-500"
                  >
                    Exportar palabras redactadas
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
