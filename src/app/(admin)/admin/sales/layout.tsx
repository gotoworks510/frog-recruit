import { requireAdmin } from "@/lib/auth/helpers";
import "./sales.css";
export default async function SalesLayout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  return <div className="sales-desk space-y-6 rounded-xl p-3 sm:p-5">{children}</div>;
}
