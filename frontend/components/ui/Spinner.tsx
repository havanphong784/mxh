import React from 'react';

export const Spinner = ({ size = 20 }: { size?: number }) => (
  <div
    className="border-2 border-[#efedf7] border-t-[#1c1b29] rounded-full animate-spin"
    style={{ width: size, height: size }}
  />
);
