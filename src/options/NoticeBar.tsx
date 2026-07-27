import { Check, Info } from 'lucide-react';
import type { Notice } from './types';

export function NoticeBar({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'success' ? <Check size={16} /> : <Info size={16} />}
      <span>{notice.message}</span>
    </div>
  );
}
