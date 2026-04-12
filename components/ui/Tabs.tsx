'use client';

interface Tab { value: string; label: string; }
interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className = '' }: TabsProps) {
  return (
    <div className={`inline-flex items-center bg-hover radius-md p-[3px] gap-0.5 ${className}`}>
      {tabs.map(tab => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`px-3.5 py-[7px] radius-sm t-xs font-medium interactive ${
              isActive
                ? 'bg-surface text-primary shadow-[0_1px_3px_rgba(0,0,0,0.18)]'
                : 'text-tertiary hover-text-primary'
            }`}
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
