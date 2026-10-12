import React from 'react';

export type StatusType =
  | 'Cleared'
  | 'Placed'
  | 'Joined'
  | 'Pending'
  | 'In Progress'
  | 'Interview'
  | 'Assessment'
  | 'Rejected'
  | 'Withdrawn'
  | 'Cancelled'
  | 'Not Applicable'
  | 'Planned'
  | 'Registered'
  | 'Eligible'
  | 'Not Eligible'
  | 'Open'
  | 'Selected'
  | 'Shortlisted'
  | 'Offer Received'
  | 'Offer'
  | 'Completed'
  | 'Incomplete'
  | 'Further action required'
  | string;

interface StatusChipProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = 'md',
  className = '',
  onClick,
}) => {
  const text = label || status;
  const s = String(status).toLowerCase().trim();

  // Green group: Cleared / Placed / Joined / Eligible / Completed
  let colorClasses = 'bg-[#EAF3ED] text-[#1E5631] border-[#CDE3D3]';

  // Amber group: Pending / In Progress / Interview / Assessment / Incomplete / Further action required
  if (
    s === 'pending' ||
    s === 'in progress' ||
    s === 'interview' ||
    s === 'assessment' ||
    s === 'incomplete' ||
    s.includes('action required')
  ) {
    colorClasses = 'bg-[#FDF6E2] text-[#8C5E09] border-[#F3E3B5]';
  }
  // Red group: Rejected / Withdrawn / Cancelled / Not Eligible
  else if (
    s === 'rejected' ||
    s === 'withdrawn' ||
    s === 'cancelled' ||
    s === 'not eligible'
  ) {
    colorClasses = 'bg-[#FCECEE] text-[#9E2A2B] border-[#F6C6CA]';
  }
  // Gray group: Not Applicable / Planned / Registered / Unplaced
  else if (
    s === 'not applicable' ||
    s === 'na' ||
    s === 'n/a' ||
    s === 'planned' ||
    s === 'registered' ||
    s === 'unplaced'
  ) {
    colorClasses = 'bg-[#F0EEE9] text-[#555953] border-[#DDD8CE]';
  }
  // Teal group: Open / Selected / Shortlisted / Offer Received / Offer
  else if (
    s === 'open' ||
    s === 'selected' ||
    s === 'shortlisted' ||
    s === 'offer received' ||
    s === 'offer'
  ) {
    colorClasses = 'bg-[#E7F5F5] text-[#13595B] border-[#C3E4E4]';
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 leading-tight'
      : 'text-xs px-2.5 py-1 leading-normal';

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-medium border rounded-[4px] tracking-wide whitespace-nowrap select-none ${sizeClasses} ${colorClasses} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
    >
      {text}
    </span>
  );
};
