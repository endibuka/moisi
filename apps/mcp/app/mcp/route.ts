import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { findTool, TOOLS } from "@/lib/tools";
import { getIssuer } from "@/lib/env";

/* MCP protocol version we advertise. Matches the 2025-03-26 / 2025-06-18
   spec range; clients we don't recognise are mirrored back. */
const SERVER_PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = {
  name: "moisi-mcp",
  title: "Moisi",
  version: "0.1.0",
};

/* ---- Bearer auth ---- */

type AuthOk = { ok: true; userId: string };
type AuthErr = { ok: false; response: NextResponse };

async function authenticate(request: NextRequest): Promise<AuthOk | AuthErr> {
  const header = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    return { ok: false, response: unauthorized("Missing Bearer token.") };
  }
  try {
    const claims = await verifyAccessToken(m[1]);
    return { ok: true, userId: claims.sub };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    return { ok: false, response: unauthorized(msg) };
  }
}

function unauthorized(description: string) {
  const issuer = getIssuer();
  return new NextResponse(JSON.stringify({ error: "unauthorized", error_description: description }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      // RFC 9728: point clients at the resource metadata so they can drive
      // the OAuth dance with no out-of-band config.
      "WWW-Authenticate":
        `Bearer realm="moisi-mcp", error="invalid_token", error_description="${description}", resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/* ---- JSON-RPC dispatch ---- */

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
};

const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
};

async function dispatch(
  req: JsonRpcRequest,
  ctx: { userId: string },
): Promise<{ result?: unknown; error?: { code: number; message: string; data?: unknown } }> {
  switch (req.method) {
    case "initialize": {
      const params = (req.params as { protocolVersion?: string }) ?? {};
      // Echo the client's protocolVersion if we recognise it, else fall back.
      const protocolVersion = params.protocolVersion ?? SERVER_PROTOCOL_VERSION;
      return {
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "Moisi MCP — stem separation tooling. Use list_jobs to see your tracks and start_separation to submit a new one.",
        },
      };
    }

    case "notifications/initialized":
    case "ping":
      return { result: {} };

    case "tools/list":
      return {
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };

    case "tools/call": {
      const p = (req.params as { name?: string; arguments?: unknown }) ?? {};
      if (!p.name || typeof p.name !== "string") {
        return { error: { code: JSONRPC_ERRORS.INVALID_PARAMS, message: "name is required" } };
      }
      const tool = findTool(p.name);
      if (!tool) {
        return { error: { code: JSONRPC_ERRORS.METHOD_NOT_FOUND, message: `Unknown tool: ${p.name}` } };
      }
      try {
        const value = await tool.handler(p.arguments ?? {}, ctx);
        return {
          result: {
            content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
            structuredContent: value,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool execution failed.";
        // Per MCP spec: tool errors are returned as a result with isError=true,
        // NOT as a JSON-RPC error (which is reserved for protocol errors).
        return {
          result: {
            content: [{ type: "text", text: message }],
            isError: true,
          },
        };
      }
    }

    default:
      return { error: { code: JSONRPC_ERRORS.METHOD_NOT_FOUND, message: `Method ${req.method} not supported` } };
  }
}

/* ---- HTTP handler ---- */

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcResponse(null, { error: { code: JSONRPC_ERRORS.PARSE_ERROR, message: "Body must be JSON-RPC 2.0" } });
  }

  // MCP requires JSON-RPC 2.0; allow a single message (no batch — clients
  // following the 2025-06-18 spec stopped sending batches).
  if (!body || typeof body !== "object" || (body as JsonRpcRequest).jsonrpc !== "2.0") {
    return rpcResponse(null, { error: { code: JSONRPC_ERRORS.INVALID_REQUEST, message: "Not a JSON-RPC 2.0 request" } });
  }

  const req = body as JsonRpcRequest;
  const out = await dispatch(req, { userId: auth.userId });

  // Notifications carry no id and expect no response.
  if (req.id === undefined || req.id === null) {
    return new NextResponse(null, {
      status: 202,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
  return rpcResponse(req.id, out);
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE, GET",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}

function rpcResponse(
  id: number | string | null,
  out: { result?: unknown; error?: { code: number; message: string; data?: unknown } },
) {
  const body: Record<string, unknown> = { jsonrpc: "2.0", id };
  if (out.error) body.error = out.error;
  else body.result = out.result;
  return NextResponse.json(body, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
