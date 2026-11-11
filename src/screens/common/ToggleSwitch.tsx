export interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
}

export function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel = 'Bật tắt tính năng',
}: ToggleSwitchProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleChange = (e: Event) => {
    e.stopPropagation();
    if (disabled) return;
    const target = e.target as HTMLInputElement;
    onChange(target.checked);
  };

  return (
    <label
      htmlFor={id}
      class={`inline-flex items-center gap-2 select-none ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
        }
      }}
    >
      <span class="relative inline-flex items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          onClick={handleClick}
          aria-label={ariaLabel}
          class="sr-only peer"
        />
        <span
          class={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
            checked ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        />
      </span>
      {label && (
        <span
          class={`text-sm font-medium ${
            disabled ? 'text-gray-400' : checked ? 'text-blue-700' : 'text-gray-600'
          }`}
        >
          {label}
        </span>
      )}
    </label>
  );
}
