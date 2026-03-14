import React from 'react';

interface ListStateViewProps {
  loading: boolean;
  isEmpty: boolean;
  loadingText: string;
  emptyText: string;
  className?: string;
  children: React.ReactNode;
}

export function ListStateView({
  loading,
  isEmpty,
  loadingText,
  emptyText,
  className,
  children,
}: ListStateViewProps) {
  if (loading) {
    return <div className={className}>{loadingText}</div>;
  }
  if (isEmpty) {
    return <div className={className}>{emptyText}</div>;
  }
  return <>{children}</>;
}

