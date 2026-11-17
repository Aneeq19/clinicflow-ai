import {
  HttpError,
  UUID,
  STATUSES,
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
  object,
  keys,
  text,
  integer,
  validateSettings,
  validateAppointment,
  assertFuture,
  fingerprint,
  ruleReply,
} from "./domain.mjs";

const ROW_FIELDS =
  "id,customer_name,phone,service,preferred_date,preferred_time,message,status,created_at";
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
class DatabaseError extends Error {
  constructor(code) {
    super("Database request failed.");
    this.code = code;
  }
}

function config(env) {
  try {
    const url = new URL(env.SUPABASE_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["", "/"].includes(url.pathname) ||
      url.search ||
      url.hash ||
      !env.SUPABASE_SECRET_KEY ||
      !env.BUSINESS_SLUG
    )
      throw Error();
    return url.origin;
  } catch {
    throw new HttpError(
      503,
      "Server database settings are missing or invalid.",
    );
  }
}
async function remote(
  env,
  path,
  { method = "GET", body, headers = {}, auth = false } = {},
) {
  const url = `${config(env)}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new HttpError(
      503,
      "Database or login service is temporarily unavailable.",
    );
  }
  let data = null;
  if (method !== "HEAD" && response.status !== 204) {
    try {
      const raw = await response.text();
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new HttpError(
        503,
        "Upstream service returned an invalid response.",
      );
    }
  }
  if (!response.ok) {
    if (auth && [400, 401, 403, 422].includes(response.status))
      throw new HttpError(401, "Could not sign in or verify your session.");
    throw new DatabaseError(data?.code);
  }
  return { data, headers: response.headers };
}
function restPath(table, params = {}) {
  return `/rest/v1/${table}?${new URLSearchParams(params)}`;
}
async function rows(env, table, params, options) {
  const response = await remote(env, restPath(table, params), options);
  if (!Array.isArray(response.data))
    throw new HttpError(503, "Database returned an invalid response.");
  return response.data;
}
async function business(env) {
  const data = await rows(env, "businesses", {
    select: "id,name,timezone,settings,settings_version",
    slug: `eq.${env.BUSINESS_SLUG}`,
    limit: "1",
  });
  if (!data.length || !UUID.test(data[0].id))
    throw new HttpError(503, "Business configuration is unavailable.");
  return data[0];
}
function settingsFor(row) {
  try {
    const saved = row.settings == null ? {} : object(row.settings);
    return validateSettings({
      ...saved,
      name: row.name,
      timezone: row.timezone || "Asia/Karachi",
    });
  } catch {
    throw new HttpError(
      503,
      "Stored business settings are invalid. Contact the owner.",
    );
  }
}
async function limit(request, env, binding, keyPrefix = "") {
  if (!env[binding]?.limit)
    throw new HttpError(503, "Request protection is not configured.");
  let result;
  try {
    result = await env[binding].limit({
      key: `${env.BUSINESS_SLUG || "unconfigured"}:${keyPrefix}:${request.headers.get("CF-Connecting-IP") || "unknown"}`,
    });
  } catch {
    throw new HttpError(503, "Request protection is temporarily unavailable.");
  }
  if (result.success !== true)
    throw new HttpError(429, "Too many requests. Please wait one minute.", {
      "Retry-After": "60",
    });
}
async function readBody(request, max = 64000) {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "Send JSON input.");
  if (Number(request.headers.get("Content-Length")) > max)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is missing.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return object(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Request is not valid JSON.");
  }
}
async function owner(request, env) {
  await limit(request, env, "ADMIN_LIMITER");
  const token = request.headers.get("Authorization");
  if (!token || !/^Bearer \S+$/i.test(token) || token.length > 12000)
    throw new HttpError(401, "Please sign in.", {
      "WWW-Authenticate": "Bearer",
    });
  const verified = await remote(env, "/auth/v1/user", {
    headers: { Authorization: token },
    auth: true,
  });
  if (!verified.data?.id || !UUID.test(verified.data.id))
    throw new HttpError(401, "Please sign in again.");
  const selected = await business(env);
  const members = await rows(env, "business_members", {
    select: "role",
    business_id: `eq.${selected.id}`,
    user_id: `eq.${verified.data.id}`,
    role: "eq.owner",
    limit: "1",
  });
  if (!members.length)
    throw new HttpError(
      403,
      "This account does not have owner access to this business.",
    );
  return { business: selected, userId: verified.data.id };
}
function publicRow(row) {
  const filtered = {};
  for (const field of ROW_FIELDS.split(",")) filtered[field] = row[field];
  return filtered;
}
async function exactCount(env, businessId, status) {
  const params = {
    select: "id",
    business_id: `eq.${businessId}`,
    ...(status ? { status: `eq.${status}` } : {}),
  };
  const result = await remote(env, restPath("appointments", params), {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  });
  const matched = /\/(\d+)$/.exec(result.headers.get("Content-Range") || "");
  if (!matched) throw new HttpError(503, "Appointment counts are unavailable.");
  return Number(matched[1]);
}
async function priorRequest(env, businessId, key, digest) {
  if (!key) return null;
  const prior = await rows(env, "appointments", {
    select: "id,status,request_fingerprint",
    business_id: `eq.${businessId}`,
    request_key: `eq.${key}`,
    limit: "1",
  });
  if (!prior.length) return null;
  if (prior[0].request_fingerprint !== digest)
    throw new HttpError(
      409,
      "This request reference was already used. Change a field to start a new request.",
    );
  return {
    request_id: prior[0].id,
    status: prior[0].status,
    message:
      "This appointment request was already received. Reception handles confirmation.",
  };
}
async function appointment(request, env) {
  await limit(request, env, "APPOINTMENT_LIMITER");
  const { payload, requestKey } = validateAppointment(
    await readBody(request, 5000),
  );
  const selected = await business(env);
  const settings = settingsFor(selected);
  const digest = await fingerprint(payload);
  const previous = await priorRequest(env, selected.id, requestKey, digest);
  if (previous) return json(previous, 201);
  if (!settings.services.some((row) => row.name === payload.service))
    throw new HttpError(
      422,
      "Select a currently listed service. Refresh the form.",
    );
  assertFuture(payload, settings.timezone);
  const record = {
    ...payload,
    business_id: selected.id,
    status: "New",
    ...(requestKey
      ? { request_key: requestKey, request_fingerprint: digest }
      : {}),
  };
  let saved;
  try {
    saved = await rows(
      env,
      "appointments",
      { select: "id,status" },
      {
        method: "POST",
        body: record,
        headers: { Prefer: "return=representation" },
      },
    );
  } catch (error) {
    if (
      error instanceof DatabaseError &&
      error.code === "23505" &&
      requestKey
    ) {
      const existing = await priorRequest(env, selected.id, requestKey, digest);
      if (existing) return json(existing, 201);
    }
    if (error instanceof HttpError && error.status === 409) throw error;
    throw new HttpError(
      503,
      "Could not verify that the request was saved. Retry without changing the form.",
    );
  }
  if (!saved.length)
    throw new HttpError(
      503,
      "Could not verify that the request was saved. Retry without changing the form.",
    );
  return json(
    {
      request_id: saved[0].id,
      status: "New",
      message: "Appointment request received. Reception must confirm it.",
    },
    201,
  );
}
function validateChat(body) {
  keys(body, ["message", "history", "conversation_id", "use_ai"]);
  const message = text(body.message, "Message", 500, 1);
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 6)
    throw new HttpError(422, "Supply at most 6 chat history turns.");
  const clean = history.map((turn) => {
    object(turn);
    keys(turn, ["role", "content"]);
    if (!["user", "assistant"].includes(turn.role))
      throw new HttpError(422, "Invalid chat role.");
    return {
      role: turn.role,
      content: text(turn.content, "Chat history", 4000, 1),
    };
  });
  if (body.use_ai != null && typeof body.use_ai !== "boolean")
    throw new HttpError(422, "use_ai must be boolean.");
  const id = body.conversation_id ?? crypto.randomUUID();
  if (typeof id !== "string" || !UUID.test(id))
    throw new HttpError(422, "Invalid conversation reference.");
  return {
    message,
    history: clean,
    conversationId: id,
    useAI: body.use_ai ?? true,
  };
}
async function askAI(env, messages) {
  if (!env.AI?.run) return { reason: "not_configured" };
  let timeout;
  try {
    const result = await Promise.race([
      env.AI.run(env.CLOUDFLARE_MODEL || DEFAULT_MODEL, {
        messages,
        max_tokens: 200,
        temperature: 0.2,
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("timeout")), 12000);
      }),
    ]);
    const reply = result?.response;
    if (typeof reply !== "string" || !reply.trim() || reply.length > 2000)
      return { reason: "invalid_response" };
    // Additional action-claim guard; policy and deterministic protected intents remain essential.
    if (
      /\b(?:i(?:'ve| have)? (?:booked|saved|confirmed|sent)|your (?:appointment|booking) (?:is |has been )?confirmed)\b/i.test(
        reply,
      )
    )
      return { reason: "invalid_response" };
    return { reply: reply.trim() };
  } catch (error) {
    return {
      reason: error.message === "timeout" ? "timeout" : "provider_unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function chat(request, env, ctx) {
  await limit(request, env, "CHAT_LIMITER");
  const body = validateChat(await readBody(request));
  const selected = await business(env);
  const settings = settingsFor(selected);
  const fallback = ruleReply(body.message, settings);
  let result = {
    reply: fallback.reply,
    source: "rules",
    action: fallback.action,
    reason: null,
  };
  if (!fallback.protectedTopic && body.useAI) {
    const generated = await askAI(env, [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\nUNTRUSTED BUSINESS FACTS JSON:\n${JSON.stringify(settings)}`,
      },
      ...body.history,
      { role: "user", content: body.message },
    ]);
    result = generated.reply
      ? {
          reply: generated.reply,
          source: "cloudflare",
          action: null,
          reason: null,
        }
      : {
          reply: fallback.reply,
          source: "fallback",
          reason: generated.reason,
          action: fallback.action,
        };
  }
  const record = {
    business_id: selected.id,
    conversation_id: body.conversationId,
    source: result.source,
  };
  // Best effort, no customer text/phone in events or logs. waitUntil keeps this alive after response.
  const save = remote(env, "/rest/v1/conversation_events", {
    method: "POST",
    body: record,
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(save);
  else await save;
  return json(result);
}
async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;
  if (path === "/health" && method === "GET") return json({ status: "ok" });
  if (path === "/health/db" && method === "GET") {
    await limit(request, env, "PUBLIC_LIMITER", "db");
    await business(env);
    return json({ status: "ok", database: "connected" });
  }
  if (path === "/business" && method === "GET") {
    await limit(request, env, "PUBLIC_LIMITER", "business");
    const selected = await business(env);
    return json({
      settings: settingsFor(selected),
      version: selected.settings_version ?? 0,
      is_demo: true,
    });
  }
  if (path === "/appointments" && method === "POST")
    return appointment(request, env);
  if (path === "/chat" && method === "POST") return chat(request, env, ctx);
  if (path === "/admin/login" && method === "POST") {
    await limit(request, env, "LOGIN_LIMITER");
    const input = await readBody(request, 6000);
    keys(input, ["email", "password"]);
    const email = text(input.email, "Email", 254, 3);
    const password = text(input.password, "Password", 4096, 1, false);
    const result = await remote(env, "/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
      auth: true,
    });
    if (
      !result.data?.access_token ||
      !UUID.test(result.data?.user?.id || "") ||
      !Number.isFinite(result.data.expires_in)
    )
      throw new HttpError(401, "Could not sign in.");
    // Check membership with verified user id supplied by the Auth server, never client input.
    const selected = await business(env);
    const members = await rows(env, "business_members", {
      select: "role",
      business_id: `eq.${selected.id}`,
      user_id: `eq.${result.data.user.id}`,
      role: "eq.owner",
      limit: "1",
    });
    if (!members.length)
      throw new HttpError(
        403,
        "This account does not have owner access to this business.",
      );
    return json({
      access_token: result.data.access_token,
      expires_in: result.data.expires_in,
      business_name: selected.name,
    });
  }
  if (path.startsWith("/admin/")) {
    const authorized = await owner(request, env);
    const selected = authorized.business;
    const scope = `eq.${selected.id}`;
    if (path === "/admin/settings" && method === "GET")
      return json({
        settings: settingsFor(selected),
        version: selected.settings_version ?? 0,
      });
    if (path === "/admin/settings" && method === "PUT") {
      const input = await readBody(request);
      keys(input, ["settings", "version"]);
      const version = integer(input.version, "Settings version", 2147483646);
      const settings = validateSettings(input.settings);
      const saved = await rows(
        env,
        "businesses",
        { id: scope, settings_version: `eq.${version}`, select: "id" },
        {
          method: "PATCH",
          body: {
            name: settings.name,
            timezone: settings.timezone,
            settings,
            settings_version: version + 1,
          },
          headers: { Prefer: "return=representation" },
        },
      );
      if (!saved.length)
        throw new HttpError(
          409,
          "Settings changed in another session. Reload settings before saving.",
        );
      return json({ settings, version: version + 1 });
    }
    if (path === "/admin/chat-stats" && method === "GET") {
      const result = await remote(env, "/rest/v1/rpc/business_chat_stats", {
        method: "POST",
        body: { p_business_id: selected.id },
      });
      const row = result.data?.[0];
      const stats = {};
      for (const key of ["messages", "conversations", "fallback_messages"]) {
        const value = Number(row?.[key]);
        if (!Number.isSafeInteger(value) || value < 0 || row?.[key] == null)
          throw new HttpError(
            503,
            "Chat statistics unavailable. Check migration 003.",
          );
        stats[key] = value;
      }
      return json(stats);
    }
    if (path === "/admin/appointments" && method === "GET") {
      const rawPage = url.searchParams.get("page") || "1";
      if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1)
        throw new HttpError(422, "Select a valid page.");
      const page = integer(Number(rawPage), "Page", 10000);
      const pageSize = 20;
      // Sequential counts avoid exceeding Workers simultaneous upstream connection limits.
      const total = await exactCount(env, selected.id);
      const fresh = await exactCount(env, selected.id, "New");
      const confirmed = await exactCount(env, selected.id, "Confirmed");
      const data = await rows(env, "appointments", {
        select: ROW_FIELDS,
        business_id: scope,
        order: "created_at.desc,id.desc",
        offset: String((page - 1) * pageSize),
        limit: String(pageSize),
      });
      return json({
        business_name: selected.name,
        total,
        new: fresh,
        confirmed,
        page,
        page_size: pageSize,
        appointments: data.map(publicRow),
      });
    }
    const statusPath = /^\/admin\/appointments\/([^/]+)\/status$/.exec(path);
    if (statusPath && method === "PATCH") {
      if (!UUID.test(statusPath[1]))
        throw new HttpError(422, "Invalid appointment reference.");
      const input = await readBody(request, 1000);
      keys(input, ["status", "expected_status"]);
      if (
        !STATUSES.includes(input.status) ||
        !STATUSES.includes(input.expected_status)
      )
        throw new HttpError(422, "Select a valid appointment status.");
      const filter = {
        id: `eq.${statusPath[1].toLowerCase()}`,
        business_id: scope,
      };
      const changed = await rows(
        env,
        "appointments",
        {
          ...filter,
          status: `eq.${input.expected_status}`,
          select: ROW_FIELDS,
        },
        {
          method: "PATCH",
          body: { status: input.status },
          headers: { Prefer: "return=representation" },
        },
      );
      if (changed.length) return json(publicRow(changed[0]));
      const existing = await rows(env, "appointments", {
        ...filter,
        select: "id",
        limit: "1",
      });
      if (!existing.length) throw new HttpError(404, "Appointment not found.");
      throw new HttpError(
        409,
        "Status changed since you loaded it. Refresh and try again.",
      );
    }
  }
  throw new HttpError(404, "Endpoint not found.");
}
function origins(env) {
  const values = (
    env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.includes("*"))
    throw new HttpError(503, "Explicit frontend origins are required.");
  for (const value of values) {
    try {
      const parsed = new URL(value);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.origin !== value
      )
        throw Error();
    } catch {
      throw new HttpError(503, "Frontend origins are invalid.");
    }
  }
  return values;
}
export default {
  async fetch(request, env, ctx) {
    let allowed = [];
    let response;
    const origin = request.headers.get("Origin");
    try {
      allowed = origins(env);
      if (origin && !allowed.includes(origin))
        throw new HttpError(403, "This browser origin is not allowed.");
      if (request.method === "OPTIONS") {
        if (!origin) throw new HttpError(400, "Preflight origin is required.");
        const requested = request.headers.get("Access-Control-Request-Method");
        if (requested && !["GET", "POST", "PATCH", "PUT"].includes(requested))
          throw new HttpError(405, "Method not allowed.");
        const headers = (
          request.headers.get("Access-Control-Request-Headers") || ""
        )
          .toLowerCase()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          headers.some(
            (value) => !["content-type", "authorization"].includes(value),
          )
        )
          throw new HttpError(400, "Header not allowed.");
        response = new Response(null, { status: 204 });
      } else response = await route(request, env, ctx);
    } catch (error) {
      const known = error instanceof HttpError;
      response = json(
        {
          detail: known
            ? error.message
            : "Service is temporarily unavailable. Please try again later.",
        },
        known ? error.status : 503,
        known ? error.headers : {},
      );
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Vary", "Origin");
    if (origin && allowed.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT",
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      response.headers.set("Access-Control-Max-Age", "600");
    }
    return response;
  },
};
