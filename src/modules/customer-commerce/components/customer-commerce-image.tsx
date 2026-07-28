import { ImageIcon } from "lucide-react";
import Image from "next/image";

const safeLocalAssetPattern =
  /^\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export interface CustomerCommerceImageProps {
  readonly src: string | null;
  readonly alt: string;
  readonly sizes: string;
  readonly className?: string;
}

export function CustomerCommerceImage({
  src,
  alt,
  sizes,
  className = "",
}: CustomerCommerceImageProps) {
  if (src === null || !safeLocalAssetPattern.test(src)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`grid place-items-center bg-brand-blue-soft text-brand-blue-strong ${className}`}
      >
        <ImageIcon aria-hidden="true" className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
