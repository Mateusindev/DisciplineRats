"use client";

// Calendário estilo shadcn (react-day-picker) adaptado aos tokens M3 do app.
// Cabeçalho próprio (título + navegação) com ícones Material; grid do mês do RDP.
import { DayPicker } from "react-day-picker";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MI } from "@/components/ui";
import { cn } from "@/lib/utils";

function DayButton({ day, modifiers, className, getDayColors, ...props }) {
  const colors = (getDayColors && getDayColors(day.date)) || [];
  return (
    <button
      {...props}
      className={cn(
        "relative w-10 h-10 rounded-lg flex items-center justify-center text-body-md transition active:scale-90",
        modifiers.selected
          ? "bg-primary-container text-on-primary-container font-bold"
          : modifiers.today
          ? "text-primary font-bold ring-1 ring-primary/40"
          : "text-on-surface hover:bg-surface-variant/60",
        modifiers.outside && "text-outline/40",
        modifiers.disabled && "opacity-40 pointer-events-none",
        className
      )}
    >
      <span>{day.date.getDate()}</span>
      {colors.length > 0 && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {colors.slice(0, 3).map((c, i) => (
            <span key={i} className="w-1 h-1 rounded-full" style={{ background: c }} />
          ))}
        </span>
      )}
    </button>
  );
}

export function Calendar({ month, onMonthChange, getDayColors, className, ...props }) {
  return (
    <div className={cn("select-none", className)}>
      {/* cabeçalho próprio */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline-md text-headline-md text-primary capitalize">{format(month, "LLLL yyyy", { locale: ptBR })}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Mês anterior"
            className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"
          >
            <MI name="chevron_left" />
          </button>
          <button
            onClick={() => onMonthChange(new Date())}
            aria-label="Hoje"
            className="px-2 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition font-label-caps text-[10px]"
          >
            HOJE
          </button>
          <button
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Próximo mês"
            className="w-8 h-8 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-variant/60 transition"
          >
            <MI name="chevron_right" />
          </button>
        </div>
      </div>

      <DayPicker
        month={month}
        onMonthChange={onMonthChange}
        locale={ptBR}
        showOutsideDays
        hideNavigation
        classNames={{
          month_caption: "hidden",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "w-10 h-8 flex items-center justify-center text-outline text-[10px] font-label-caps uppercase",
          week: "flex w-full mt-1",
          day: "w-10 h-10 p-0",
        }}
        components={{ DayButton: (dp) => <DayButton {...dp} getDayColors={getDayColors} /> }}
        {...props}
      />
    </div>
  );
}
