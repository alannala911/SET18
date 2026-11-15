import "./FilterControls.css";

const activitySortOptions = [
  ["date", "Dato"], ["time", "Tid på dagen"], ["duration", "Varighet"],
  ["location", "Sted"], ["price", "Pris (laveste billett)"],
];

export function FilterControls({
  label = "Filtrer og sorter aktiviteter",
  sortOptions = activitySortOptions,
  periodFilter,
  sortBy,
  sortDirection,
  isAdvancedOpen,
  customStartDate,
  customEndDate,
  onPeriodChange,
  onSortByChange,
  onSortDirectionChange,
  onAdvancedToggle,
  onStartDateChange,
  onEndDateChange,
}) {
  const filters = [
    ["Tidsperiode", periodFilter, onPeriodChange, [
      ["all", "Alle perioder"], ["today", "I dag"],
      ["next-seven-days", "Neste 7 dager"], ["next-thirty-days", "Neste 30 dager"],
    ]],
    ["Sorter etter", sortBy, onSortByChange, sortOptions],
    ["Rekkefølge", sortDirection, onSortDirectionChange, [
      ["ascending", "Stigende"], ["descending", "Synkende"],
    ]],
  ];
  const dates = [
    ["Fra dato", customStartDate, onStartDateChange],
    ["Til dato", customEndDate, onEndDateChange],
  ];

  return (
    <section className="activity-controls" aria-label={label}>
      {filters.map(([filterLabel, value, onChange, options]) => (
        <label key={filterLabel}>
          <span>{filterLabel}</span>
          <select value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map(([optionValue, optionLabel]) => (
              <option key={optionValue} value={optionValue}>{optionLabel}</option>
            ))}
          </select>
        </label>
      ))}
      <button type="button" className="activity-advanced-toggle" aria-expanded={isAdvancedOpen} onClick={onAdvancedToggle}>
        Avansert valg
      </button>
      {isAdvancedOpen && (
        <div className="activity-date-range">
          {dates.map(([dateLabel, value, onChange]) => (
            <label key={dateLabel}>
              <span>{dateLabel}</span>
              <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
