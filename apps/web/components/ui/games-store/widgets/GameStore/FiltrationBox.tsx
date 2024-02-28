export function FiltrationBox<T extends string>({
  expanded,
  title,
  items,
  itemsSelected,
  setItemsSelected,
}: {
  expanded: boolean;
  title: string;
  items: T[];
  itemsSelected: T[];
  setItemsSelected: (genres: T[]) => void;
}) {
  return (
    <div className="relative min-h-[80px] w-full p-5">
      <div className="text-[24px] font-bold">{title}</div>
      {items.map((item) => (
        <div
          key={item}
          className={`text-plexmono cursor-pointer font-[20] hover:underline ${
            itemsSelected.includes(item) ? 'underline' : ''
          } decoration-left-accent underline-offset-[5px]`}
          onClick={() => {
            setItemsSelected(
              itemsSelected.includes(item)
                ? itemsSelected.filter((x) => x != item)
                : [...itemsSelected, item]
            );
          }}
        >
          {item}
        </div>
      ))}

      <div className="absolute left-0 top-0 -z-10 flex h-full w-full flex-col">
        <svg
          viewBox="0 0 351 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 17.5234V111.731V174.523C1 182.808 7.71573 189.523 16 189.523H335C343.284 189.523 350 182.808 350 174.523V58.1101C350 54.1286 348.417 50.3105 345.6 47.4969L304.963 6.91027C302.151 4.10124 298.338 2.52344 294.363 2.52344H16C7.71573 2.52344 1 9.23917 1 17.5234Z"
            stroke="#D2FF00"
            strokeWidth="2"
          />
          <path
            d="M348 2.52344H312.912C311.118 2.52344 310.231 4.7018 311.515 5.95459L346.603 40.2072C347.87 41.4438 350 40.5463 350 38.7761V4.52344C350 3.41887 349.105 2.52344 348 2.52344Z"
            fill={expanded ? '#D2FF00' : ''}
            stroke="#D2FF00"
            strokeWidth="2"
          />
          <rect
            x="331.775"
            y="6.89062"
            width="20"
            height="2"
            transform="rotate(45 331.775 6.89062)"
            fill={expanded ? '#252525' : '#D2FF00'}
          />
          <rect
            x="345.924"
            y="8.30469"
            width="20"
            height="2"
            transform="rotate(135 345.924 8.30469)"
            fill={expanded ? '#252525' : '#D2FF00'}
          />
        </svg>
        <div className="flex w-full flex-grow rounded-b-2xl border-x-2 border-b-2 border-left-accent"></div>
      </div>
    </div>
  );
}
