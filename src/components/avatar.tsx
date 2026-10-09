import { AVATARS, isPhotoDataUrl } from "@/lib/room-meta";

/** A person's photo if they set one, otherwise their emoji. Fills its parent circle. */
export function Avatar({ emoji, photo }: { emoji?: string; photo?: string }) {
  if (isPhotoDataUrl(photo)) {
    // A tiny inline data URL: next/image would add nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" draggable={false} className="size-full rounded-[inherit] object-cover" />;
  }
  return <span aria-hidden>{emoji || AVATARS[0]}</span>;
}
