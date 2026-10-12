import React from 'react';

export const Spinner = ({ size = 20 }: { size?: number }) => (
  <div
    className="border-2 border-[#d5d5d5] border-t-[#000000] rounded-full animate-spin"
    style={{ width: size, height: size }}
  />
);
