type CatalogQtyInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  overStock?: boolean;
  className?: string;
};

/** Quantity field with always-visible dark hint text. */
export function CatalogQtyInput({
  value,
  onChange,
  onBlur,
  overStock = false,
  className = '',
}: CatalogQtyInputProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold text-gray-700 leading-none px-0.5">
        Specify the Quantity
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder="1"
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={onBlur}
        className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all text-center font-semibold tabular-nums
          placeholder:text-gray-400
          ${overStock
            ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400'
            : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-papco-navy focus:bg-white'}`}
      />
    </div>
  );
}
