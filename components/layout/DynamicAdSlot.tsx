import AdSlot from "./AdSlot";
import { getAdSlotId } from "@/lib/get-ads";

/** Server component: pulls the slot ID from the DB. Admin adds slots in /admin/monetization — ads go live instantly. */
export default async function DynamicAdSlot({
  placement,
  format = "auto",
  className,
}: {
  placement: string;
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}) {
  const slot = await getAdSlotId(placement);
  return <AdSlot slot={slot ?? ""} format={format} className={className} />;
}
