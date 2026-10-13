declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      role: "ADMIN" | "SALES" | "SALES_ADMIN";
      salesType: "INTERNAL" | "EXTERNAL" | null;
    }

    interface Request {
      user: User;
    }
  }
}

export {};
