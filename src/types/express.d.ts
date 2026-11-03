declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      validated?: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

export {};
