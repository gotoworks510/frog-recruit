import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
    status?: string;
    companyId?: string | null;
    privacyConsentedAt?: number | null;
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
  }
}
