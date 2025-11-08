
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
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
    id: string;
    role?: "ADMIN" | "AGENT" | "CUSTOMER";
    clientId?: string | null;
  }
}
