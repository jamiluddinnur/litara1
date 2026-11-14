export default function Logo({ size = 40 }: { size?: number }) {
  // Monogram L Minimal: bidang terbagi horizontal merah di atas / putih di bawah,
  // huruf L berbalik warna (putih di atas merah, merah di atas putih), titik putih di bidang merah.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Logo Litara" style={{ borderRadius: 11, boxShadow: "0 2px 8px rgba(0,0,0,.2)", background: "#fff" }}>
      <defs>
        <clipPath id="litara-box"><rect x="0" y="0" width="64" height="64" rx="11" /></clipPath>
        <clipPath id="litara-top"><rect x="0" y="0" width="64" height="32" /></clipPath>
        <clipPath id="litara-bottom"><rect x="0" y="32" width="64" height="32" /></clipPath>
      </defs>
      <g clipPath="url(#litara-box)">
        <rect x="0" y="0" width="64" height="32" fill="#c8102e" />
        <rect x="0" y="32" width="64" height="32" fill="#ffffff" />
        <g clipPath="url(#litara-top)"><path d="M19 13h10.5v27.5H46V51H19" fill="#ffffff" /></g>
        <g clipPath="url(#litara-bottom)"><path d="M19 13h10.5v27.5H46V51H19" fill="#c8102e" /></g>
        <circle cx="47.5" cy="17.5" r="4.8" fill="#ffffff" />
      </g>
      <rect x="0.5" y="0.5" width="63" height="63" rx="11" fill="none" stroke="#e5e7eb" />
    </svg>
  );
}
