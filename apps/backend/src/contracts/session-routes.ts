import type { FastifyInstance } from "fastify";
import { requireRequestUserId, UnauthenticatedError } from "../auth/request-user.js";

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/session", async (req, reply) => {
    try {
      const userId = requireRequestUserId(req);
      return { authenticated: true, userId };
    } catch (error) {
      if (!(error instanceof UnauthenticatedError)) throw error;
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
  });
}
