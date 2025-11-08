"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Database, Users, Code, Table } from 'lucide-react';

const orgamaxPages = [
  {
    href: '/admin/orgamax',
    label: 'Dashboard',
    icon: Database,
  },
  {
    href: '/admin/orgamax/customers',
    label: 'Kunden',
    icon: Users,
  },
  {
    href: '/admin/orgamax/customers-extended',
    label: 'Erweiterte Kunden',
    icon: Users,
  },
  {
    href: '/admin/orgamax/api-explorer',
    label: 'API Explorer',
    icon: Code,
  },
  {
    href: '/admin/orgamax/structure',
    label: 'Datenstruktur',
    icon: Table,
  },
];

export function OrgamaxNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/50 p-3">
      {orgamaxPages.map((page) => {
        const Icon = page.icon;
        const isActive = pathname === page.href;

        return (
          <Button
            key={page.href}
            asChild
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
          >
            <Link href={page.href}>
              <Icon className="h-4 w-4" />
              {page.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
