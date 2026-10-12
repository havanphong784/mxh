import React from 'react';

interface AvatarProps {
  src: string | null | undefined;
  displayName?: string;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  displayName = 'U',
  size = 32,
  className = '',
}) => {
  const initials = displayName.trim().charAt(0).toUpperCase() || 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={displayName}
        width={size}
        height={size}
        className={`rounded-full object-cover border border-[#d5d5d5] ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-[#efefef] text-[#424242] flex items-center justify-center font-semibold text-[13px] border border-[#d5d5d5] select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {initials}
    </div>
  );
};
