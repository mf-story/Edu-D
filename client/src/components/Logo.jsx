// Logo.jsx — Logo aplikasi EduMuh (topi wisuda modern dengan gradient).
export default function Logo({ size = 32, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Edu-D"
    >
      <defs>
        <linearGradient id="eduLogoGrad" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="eduLogoShine" x1="24" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* Latar bulat lembut */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#eduLogoGrad)" />
      {/* Topi wisuda (mortarboard) */}
      <path
        d="M24 13L40 20L24 27L8 20L24 13Z"
        fill="url(#eduLogoShine)"
      />
      <path
        d="M24 27L14 22.6V29.5C14 31.9 18.5 34 24 34C29.5 34 34 31.9 34 29.5V22.6L24 27Z"
        fill="#ffffff"
        fillOpacity="0.85"
      />
      {/* Tali & jumbai */}
      <path
        d="M40 20V29"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="40" cy="31" r="2.4" fill="#ffffff" />
    </svg>
  );
}
