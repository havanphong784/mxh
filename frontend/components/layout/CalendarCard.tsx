'use client';

import { useState } from 'react';

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function CalendarCard() {
  const [today] = useState(() => new Date());
  const [monthOffset, setMonthOffset] = useState(0);

  const viewedMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const firstDayOffset = (viewedMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(viewedMonth);

  return <section className="mt-7 rounded-[24px] bg-[#f4f2fa] p-4" aria-label="Lịch tháng">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-extrabold capitalize text-[#1c1b29]">{label}</h3>
      <div className="flex gap-1">
        <button type="button" onClick={() => setMonthOffset((value) => value - 1)} aria-label="Tháng trước" className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#7b78ff] hover:bg-[#eeedff]">‹</button>
        <button type="button" onClick={() => setMonthOffset((value) => value + 1)} aria-label="Tháng sau" className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#7b78ff] hover:bg-[#eeedff]">›</button>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-7 gap-y-1 text-center text-[10px] font-bold text-[#8e8ca3]">
      {weekdays.map((day) => <span key={day}>{day}</span>)}
      {Array.from({ length: firstDayOffset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const isToday = monthOffset === 0 && day === today.getDate();
        return <span key={day} className={`mx-auto grid h-7 w-7 place-items-center rounded-full ${isToday ? 'bg-[#64b5f6] text-white shadow-[0_4px_10px_rgba(100,181,246,.35)]' : 'text-[#4a4860]'}`} aria-current={isToday ? 'date' : undefined}>{day}</span>;
      })}
    </div>
  </section>;
}
