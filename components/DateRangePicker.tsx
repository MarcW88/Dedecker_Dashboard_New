import { useState, useEffect } from 'react';

interface DateRangePickerProps {
  availableDates: string[];
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay() || 7; // 1 = Monday
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function DateRangePicker({
  availableDates,
  fromDate,
  toDate,
  onChange,
}: DateRangePickerProps) {
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (toDate) {
      const d = new Date(toDate);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [toDate]);

  const yearMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const days = daysInMonth(viewYear, viewMonth);
  const start = firstWeekday(viewYear, viewMonth);

  const isAvailable = (day: number) =>
    availableDates.some((d) => d.startsWith(`${yearMonth}-${String(day).padStart(2, '0')}`));

  const dayString = (day: number) => `${yearMonth}-${String(day).padStart(2, '0')}`;

  const handleDayClick = (day: number) => {
    const date = dayString(day);
    if (!availableDates.includes(date)) return;

    if (!picking) {
      if (date === fromDate) {
        setPicking('from');
      } else if (date === toDate) {
        setPicking('to');
      } else if (fromDate === toDate && fromDate === date) {
        setPicking('from');
      } else {
        onChange(fromDate, date);
      }
      return;
    }

    if (picking === 'from') {
      const newFrom = date;
      const newTo = newFrom > toDate ? newFrom : toDate;
      onChange(newFrom, newTo);
      setPicking(null);
    } else {
      const newTo = date;
      const newFrom = newTo < fromDate ? newTo : fromDate;
      onChange(newFrom, newTo);
      setPicking(null);
    }
  };

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
        <CalendarIcon />
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setPicking(picking === 'from' ? null : 'from')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              picking === 'from'
                ? 'bg-taupe-dark text-white border-taupe-dark'
                : 'bg-white border-stone-200 text-stone-600 hover:border-taupe'
            }`}
          >
            From {fromDate}
          </button>
          <span className="text-stone-400">→</span>
          <button
            onClick={() => setPicking(picking === 'to' ? null : 'to')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              picking === 'to'
                ? 'bg-taupe-dark text-white border-taupe-dark'
                : 'bg-white border-stone-200 text-stone-600 hover:border-taupe'
            }`}
          >
            To {toDate}
          </button>
        </div>
      </div>

      {picking && (
        <div className="absolute right-0 top-12 z-20 bg-white border border-stone-200 rounded-xl shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-1 hover:bg-stone-100 rounded">
              <ChevronLeft />
            </button>
            <span className="text-xs font-medium text-stone-600">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-stone-100 rounded">
              <ChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 mb-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: start - 1 }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const ds = dayString(day);
              const available = isAvailable(day);
              const isFrom = ds === fromDate;
              const isTo = ds === toDate;
              const inRange = available && ds >= fromDate && ds <= toDate;

              return (
                <button
                  key={day}
                  disabled={!available}
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-7 w-7 rounded-full text-xs flex items-center justify-center
                    ${!available ? 'text-stone-300 cursor-default' : 'cursor-pointer'}
                    ${isFrom || isTo ? 'bg-taupe-dark text-white font-medium' : ''}
                    ${!isFrom && !isTo && inRange ? 'bg-taupe/20 text-taupe-dark' : ''}
                    ${!isFrom && !isTo && !inRange && available ? 'text-stone-600 hover:bg-stone-100' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-stone-400 mt-2 text-center">
            {picking === 'from' ? 'Select start date' : 'Select end date'}
          </p>
        </div>
      )}
    </div>
  );
}
