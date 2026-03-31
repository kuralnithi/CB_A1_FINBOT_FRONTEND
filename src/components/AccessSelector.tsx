'use client';

import { ROLES, ROLE_LABELS, ROLE_COLORS } from '@/lib/constants';

interface AccessSelectorProps {
  primaryRole: string;
  selected: string[];
  onChange: (roles: string[]) => void;
}

/**
 * Component for selecting extra access roles.
 */
export function AccessSelector({ primaryRole, selected, onChange }: AccessSelectorProps) {
  const available = ROLES.filter((r) => r !== primaryRole);

  const toggle = (role: string) => {
    const next = selected.includes(role)
      ? selected.filter((r) => r !== role)
      : [...selected, role];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((r) => {
        const on = selected.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            className={`px-2 py-0.5 text-xs rounded-full border font-medium transition-all ${
              on ? ROLE_COLORS[r] : 'bg-dark-800 text-dark-500 border-dark-700'
            }`}
          >
            {on ? '✓ ' : ''}
            {ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}
