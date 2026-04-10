interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  // Set statuses
  NISB: 'bg-emerald-100 text-emerald-700',
  COMPLETE_WITH_BOX: 'bg-blue-100 text-blue-700',
  COMPLETE_NO_BOX: 'bg-sky-100 text-sky-700',
  INCOMPLETE: 'bg-amber-100 text-amber-700',
  PARTS_ONLY: 'bg-gray-100 text-gray-600',
  // Minifig statuses
  COMPLETE: 'bg-emerald-100 text-emerald-700',
  // MOC statuses
  PLANNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ON_HOLD: 'bg-gray-100 text-gray-600',
  SOLD: 'bg-gray-200 text-gray-500',
  // Conditions
  NEW: 'bg-emerald-100 text-emerald-700',
  EXCELLENT: 'bg-blue-100 text-blue-700',
  GOOD: 'bg-sky-100 text-sky-700',
  FAIR: 'bg-amber-100 text-amber-700',
  POOR: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  NISB: 'New In Sealed Box',
  COMPLETE_WITH_BOX: 'Complete w/ Box',
  COMPLETE_NO_BOX: 'Complete (No Box)',
  INCOMPLETE: 'Incomplete',
  PARTS_ONLY: 'Parts Only',
  SOLD: 'Sold',
  COMPLETE: 'Complete',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  NEW: 'New',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-600';
  const label = statusLabels[status] || status;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}
