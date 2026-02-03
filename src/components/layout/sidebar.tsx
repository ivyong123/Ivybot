'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'Stock Analysis',
    href: '/',
    icon: '📈',
  },
  {
    title: 'Options Analysis',
    href: '/?type=options',
    icon: '📊',
  },
  {
    title: 'AI Chat',
    href: '/chat',
    icon: '💬',
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/10">
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start gap-2 px-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <span>{item.icon}</span>
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          CheekyTrader AI v1.0
        </p>
      </div>
    </aside>
  );
}
