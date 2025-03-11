'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  href: string;
}

interface PageLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  children: ReactNode;
}

export function PageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            {breadcrumbs.map((breadcrumb, index) => (
              <li key={index} className="inline-flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                )}
                <Link
                  href={breadcrumb.href}
                  className={`inline-flex items-center text-sm font-medium ${
                    index === breadcrumbs.length - 1
                      ? 'text-gray-500 cursor-default'
                      : 'text-primary hover:text-primary/80'
                  }`}
                  aria-current={
                    index === breadcrumbs.length - 1 ? 'page' : undefined
                  }
                >
                  {breadcrumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex space-x-2">{actions}</div>}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
} 