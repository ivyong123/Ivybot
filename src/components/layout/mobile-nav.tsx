'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

const navLinks = [
  { href: '/', label: 'Analysis', icon: '📊' },
  { href: '/history', label: 'History', icon: '📋' },
  { href: '/chat', label: 'AI Chat', icon: '💬' },
  { href: '/backtest', label: 'Backtest', icon: '🎯' },
  { href: '/diagnostics', label: 'Status', icon: '🔧' },
  { href: '/help', label: 'Help', icon: '❓' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="md:hidden flex items-center justify-center h-11 w-11 rounded-xl glass-subtle hover:bg-primary/10 transition-all"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <ChartIcon className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl gradient-text">CheekyTrader</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 pt-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <SheetClose key={link.href} asChild>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
