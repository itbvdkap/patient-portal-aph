import Image from "next/image";

export function BrandLogo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_rgba(7,60,57,0.14)] ring-1 ring-primary-100 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-an-phu.jpg"
        alt="Bệnh viện Đa khoa An Phú"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority={size >= 48}
      />
    </span>
  );
}
