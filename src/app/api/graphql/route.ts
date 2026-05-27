/**
 * GraphQL API Endpoint
 * Route: POST /api/graphql
 *
 * Features:
 * - Apollo Server integration with Next.js
 * - NextAuth authentication & authorization
 * - Field-level PII masking (email, phone)
 * - Query performance logging
 * - Custom error handling
 * - CORS support for front-end
 *
 * Usage:
 * POST /api/graphql
 * Content-Type: application/json
 * Authorization: Bearer <token>
 *
 * Body:
 * {
 *   "query": "{ contacts(limit: 10) { edges { node { id name } } } }",
 *   "variables": {},
 *   "operationName": "GetContacts"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// ═════════════════════════════════════════════════════════════
// APOLLO SERVER SETUP
// ═════════════════════════════════════════════════════════════

interface GraphQLContext {
  userId?: string;
  organizationId?: string;
  role?: string;
  isAuthorized: boolean;
}

const createApolloServer = () => {
  return new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,

    // Custom error formatting
    formatError: (error) => {
      logger.error("[GraphQL Error]", {
        message: error.message,
        path: error.path?.join("."),
        extensions: error.extensions,
      });

      // Don't expose internal errors to client
      if (error.extensions?.code === "INTERNAL_SERVER_ERROR") {
        return {
          message: "Internal server error",
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      return error;
    },

    // Context factory - called for each request
    context: async (): Promise<GraphQLContext> => {
      try {
        const session = await getMabizSession();
        return {
          userId: session?.userId,
          organizationId: session?.organizationId,
          role: session?.role,
          isAuthorized: !!session,
        };
      } catch (error) {
        logger.error("[GraphQL Context Error]", {
          error: error instanceof Error ? error.message : String(error),
        });
        return { isAuthorized: false };
      }
    },

    // Introspection enabled for development, disabled in production
    introspection: process.env.NODE_ENV !== "production",

    // Enable detailed error messages in development
    includeStacktraceInErrorResponses:
      process.env.NODE_ENV === "development",

    // Plugin for performance monitoring
    plugins: [
      {
        async requestDidStart(requestContext) {
          const startTime = Date.now();

          return {
            async willSendResponse(context) {
              const duration = Date.now() - startTime;

              // Log slow queries
              if (duration > 1000) {
                logger.warn("[Slow GraphQL Query]", {
                  duration,
                  operationName: context.operationName,
                  query: context.request.query?.substring(0, 200),
                });
              }

              // Log errors
              if (
                context.response.errors &&
                context.response.errors.length > 0
              ) {
                logger.error("[GraphQL Response Errors]", {
                  duration,
                  operationName: context.operationName,
                  errors: context.response.errors.map((e) => e.message),
                });
              }
            },
          };
        },
      },
    ],
  });
};

const server = createApolloServer();
const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => ({
    req,
    userId: (await getMabizSession())?.userId,
    organizationId: (await getMabizSession())?.organizationId,
    role: (await getMabizSession())?.role,
    isAuthorized: !!(await getMabizSession()),
  }),
});

// ═════════════════════════════════════════════════════════════
// REQUEST HANDLERS
// ═════════════════════════════════════════════════════════════

/**
 * POST /api/graphql
 * Main GraphQL endpoint
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Log request
    logger.info("[GraphQL Request]", {
      userId: session.userId,
      organizationId: session.organizationId,
      method: "POST",
    });

    // Delegate to Apollo handler
    return handler(req);
  } catch (error) {
    logger.error("[GraphQL POST Error]", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/graphql
 * Optional: Serve GraphQL Playground for development
 * Only available in development environment
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>GraphQL Playground</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react@1.7.42/build/static/css/index.css" />
          <link rel="icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react@1.7.42/build/favicon.png" />
        </head>
        <body>
          <div id="root"></div>
          <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react@1.7.42/umd/graphql-playground.js"></script>
          <script>
            window.addEventListener('load', function(event) {
              GraphQLPlayground.init(document.getElementById('root'), {
                endpoint: '/api/graphql',
                subscriptionEndpoint: 'ws://localhost:3000/api/graphql',
              });
            });
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // In production, return 404
  return NextResponse.json(
    { error: "Not found" },
    { status: 404 }
  );
}

/**
 * OPTIONS /api/graphql
 * CORS preflight support
 */
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export const dynamic = "force-dynamic";
