import { requireSalesAdmin as requireAdmin } from "@/lib/sales/auth";
import "./sales.css";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function SalesLayout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  return <div className="sales-desk">{children}</div>;
}
