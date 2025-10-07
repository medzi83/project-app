
declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "ADMIN" | "AGENT" | "CUSTOMER";
      clientId?: string | null;
    };
    expires?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "AGENT" | "CUSTOMER";
    clientId?: string | null;
  }
}
