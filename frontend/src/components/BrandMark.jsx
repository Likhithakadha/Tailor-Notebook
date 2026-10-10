export default function BrandMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" stroke="#b8863b" strokeWidth="1.4" />
      <path
        d="M6 16c3-4 6-6 10-6s7 2 10 6c-3 4-6 6-10 6s-7-2-10-6z"
        stroke="#b8863b"
        strokeWidth="1.4"
      />
      <circle cx="16" cy="16" r="2.4" fill="#b8863b" />
    </svg>
  );
}
