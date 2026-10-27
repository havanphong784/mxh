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
      // Avatars are user-supplied remote URLs from Cloudinary; dimensions are fixed here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={displayName}
        width={size}
        height={size}
        className={`rounded-full border-2 border-white object-cover shadow-[0_4px_12px_rgba(123,120,255,.15)] ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 border-white bg-[linear-gradient(135deg,#ffdae5,#d7d3ff)] text-[13px] font-extrabold text-[#5954ad] shadow-[0_4px_12px_rgba(123,120,255,.15)] select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {initials}
    </div>
  );
};
