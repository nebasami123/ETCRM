declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      role: "ADMIN" | "SALES";
    }

    interface Request {
      user: User;
    }
  }
}

export {};
