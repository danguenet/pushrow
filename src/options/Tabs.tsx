import { Database, History, Route, ShieldCheck } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { Tab } from './types';

const TAB_ORDER: Tab[] = ['destinations', 'rules', 'activity', 'data'];

export function Tabs({
  tab,
  destinationCount,
  ruleCount,
  activityCount,
  onSelect,
}: {
  tab: Tab;
  destinationCount: number;
  ruleCount: number;
  activityCount: number;
  onSelect: (tab: Tab) => boolean;
}) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TAB_ORDER.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TAB_ORDER[nextIndex];
    if (!nextTab || !onSelect(nextTab)) return;
    window.requestAnimationFrame(() => document.getElementById(`${nextTab}-tab`)?.focus());
  };

  const tabs = [
    { id: 'destinations' as const, label: 'Destinations', count: destinationCount, icon: Database },
    { id: 'rules' as const, label: 'Routing rules', count: ruleCount, icon: Route },
    { id: 'activity' as const, label: 'Activity', count: activityCount, icon: History },
    { id: 'data' as const, label: 'Data & privacy', count: null, icon: ShieldCheck },
  ];

  return (
    <nav className="tabs" aria-label="Settings sections" role="tablist">
      {tabs.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            id={`${item.id}-tab`}
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${item.id}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'active' : ''}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <Icon size={17} /> {item.label}
            {item.count === null ? null : <span>{item.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
