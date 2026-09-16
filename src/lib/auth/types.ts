import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
    status?: string;
    companyId?: string | null;
    privacyConsentedAt?: number | null;
    termsAcceptedAt?: number | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      status: string;
      companyId: string | null;
      privacyConsentedAt: number | null;
      termsAcceptedAt: number | null;
      /** Present only while an admin is previewing as this user. */
      viewAs?: {
        adminId: string;
        adminEmail?: string | null;
        as: "candidate" | "employer";
        label: string;
      };
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    status?: string;
    companyId?: string | null;
    privacyConsentedAt?: number | null;
    termsAcceptedAt?: number | null;
  }
}
