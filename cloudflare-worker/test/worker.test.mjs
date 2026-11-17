import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import {
  defaults,
  validateSettings,
  validateAppointment,
  canonical,
  fingerprint,
  assertFuture,
} from "../src/domain.mjs";

const BUSINESS = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const OWNER = "20000000-0000-4000-8000-000000000001";
const STRANGER = "20000000-0000-4000-8000-000000000002";
const APPOINTMENT = "30000000-0000-4000-8000-000000000001";
const FOREIGN = "30000000-0000-4000-8000-000000000002";
const KEY = "40000000-0000-4000-8000-000000000001";
const CONVERSATION = "50000000-0000-4000-8000-000000000001";
const goodAppointment = () => ({
  customer_name: "Synthetic customer",
  phone: "00000000000",
  service: "Teeth cleaning",
  preferred_date: "2099-01-05",
  preferred_time: "11:00",
  message: "Synthetic test only",
  request_key: KEY,
});
function fixture() {
  const data = {
    businesses: [
      {
        id: BUSINESS,
        slug: "pearl-dental-care",
        name: "Pearl Dental Care, Karachi",
        timezone: "Asia/Karachi",
        settings: defaults(),
        settings_version: 0,
      },
      {
        id: OTHER,
        slug: "another-business",
        name: "Other business",
        timezone: "Asia/Karachi",
        settings: defaults(),
        settings_version: 0,
      },
    ],
    business_members: [
      { business_id: BUSINESS, user_id: OWNER, role: "owner" },
      { business_id: OTHER, user_id: STRANGER, role: "owner" },
    ],
    appointments: [
      {
        id: APPOINTMENT,
        business_id: BUSINESS,
        customer_name: "Synthetic local",
        phone: "00000000000",
        service: "Archived service",
        preferred_date: "2099-01-01",
        preferred_time: "11:00:00",
        message: "Synthetic local note",
        status: "New",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: FOREIGN,
        business_id: OTHER,
        customer_name: "PRIVATE FOREIGN NAME",
        phone: "PRIVATE FOREIGN PHONE",
        service: "Other service",
        preferred_date: "2099-01-01",
        preferred_time: "11:00:00",
        message: "PRIVATE FOREIGN NOTE",
        status: "New",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    conversation_events: [],
  };
  data.businesses[0].settings.services[1].price =
    "PKR 3,000 — sample demo price";
  const calls = [];
  const waiting = [];
  const aiCalls = [];
  const rateCalls = [];
  const env = {
    SUPABASE_URL: "https://synthetic.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_synthetic_only",
    BUSINESS_SLUG: "pearl-dental-care",
    ALLOWED_ORIGINS: "https://clinic.example",
    AI: {
      run: async (...args) => {
        aiCalls.push(args);
        return { response: "Synthetic reception answer." };
      },
    },
  };
  for (const name of [
    "PUBLIC_LIMITER",
    "LOGIN_LIMITER",
    "ADMIN_LIMITER",
    "CHAT_LIMITER",
    "APPOINTMENT_LIMITER",
  ])
    env[name] = {
      limit: async (input) => {
        rateCalls.push({ name, ...input });
        return { success: true };
      },
    };
  const ctx = { waitUntil: (promise) => waiting.push(promise) };
  const response = (value, status = 200, headers = {}) =>
    new Response(value === null ? null : JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  async function upstream(input, options = {}) {
    const url = new URL(input);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    const headers = new Headers(options.headers);
    assert.equal(url.origin, "https://synthetic.supabase.co");
    assert.equal(headers.get("apikey"), env.SUPABASE_SECRET_KEY);
    assert.ok(options.signal);
    assert.equal(options.redirect, "error");
    calls.push({ url, method, body, headers });
    if (url.pathname === "/auth/v1/user") {
      const token = headers.get("Authorization");
      return token === "Bearer owner-token"
        ? response({ id: OWNER })
        : token === "Bearer stranger-token"
          ? response({ id: STRANGER })
          : response({ code: "invalid_jwt" }, 401);
    }
    if (url.pathname === "/auth/v1/token")
      return body.email === "owner@example.test" &&
        body.password === " sample password "
        ? response({
            access_token: "owner-token",
            expires_in: 3600,
            user: { id: OWNER },
            refresh_token: "must-not-leak",
          })
        : response({ code: "invalid_credentials" }, 400);
    if (url.pathname === "/rest/v1/rpc/business_chat_stats") {
      const scoped = data.conversation_events.filter(
        (row) => row.business_id === body.p_business_id,
      );
      return response([
        {
          messages: scoped.length,
          conversations: new Set(scoped.map((row) => row.conversation_id)).size,
          fallback_messages: scoped.filter((row) => row.source === "fallback")
            .length,
        },
      ]);
    }
    const table = url.pathname.slice("/rest/v1/".length);
    assert.ok(Object.hasOwn(data, table), "Unexpected table " + table);
    // Data API operations use only the service apikey, never the owner's bearer token.
    assert.equal(headers.get("Authorization"), null);
    let selected = data[table].filter((row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          !value.startsWith("eq.") || String(row[key]) === value.slice(3),
      ),
    );
    const selectedFields = url.searchParams.get("select");
    const project = (rows) =>
      rows.map((row) =>
        selectedFields
          ? Object.fromEntries(
              selectedFields.split(",").map((key) => [key, row[key]]),
            )
          : { ...row },
      );
    if (method === "HEAD")
      return response(null, 200, { "Content-Range": `*/${selected.length}` });
    if (method === "PATCH") {
      for (const row of selected) Object.assign(row, structuredClone(body));
      return response(project(selected));
    }
    if (method === "POST") {
      if (
        table === "appointments" &&
        body.request_key &&
        data.appointments.some(
          (row) =>
            row.business_id === body.business_id &&
            row.request_key === body.request_key,
        )
      )
        return response({ code: "23505" }, 409);
      const row = {
        id: crypto.randomUUID(),
        created_at: "2026-01-02T00:00:00Z",
        ...structuredClone(body),
      };
      data[table].push(row);
      return headers.get("Prefer") === "return=minimal"
        ? response(null, 201)
        : response(project([row]), 201);
    }
    const offset = Number(url.searchParams.get("offset") || 0);
    const count = Number(url.searchParams.get("limit") || selected.length);
    return response(project(selected.slice(offset, offset + count)));
  }
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = upstream;
  async function request(
    path,
    {
      method = "GET",
      body,
      token,
      origin = "https://clinic.example",
      headers = {},
    } = {},
  ) {
    const request = new Request("https://worker.example" + path, {
      method,
      headers: {
        "CF-Connecting-IP": "192.0.2.1",
        ...(origin ? { Origin: origin } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return worker.fetch(request, env, ctx);
  }
  return {
    data,
    env,
    ctx,
    calls,
    waiting,
    aiCalls,
    rateCalls,
    request,
    upstream,
    restore: () => {
      globalThis.fetch = nativeFetch;
    },
  };
}
async function using(fn) {
  const f = fixture();
  try {
    await fn(f);
  } finally {
    await Promise.all(f.waiting);
    f.restore();
  }
}

// Sequential tests isolate the mocked network. None makes an actual provider/database request.
test("health is credential-free; public config exposes only approved settings", () =>
  using(async (f) => {
    const health = await f.request("/health");
    assert.deepEqual(await health.json(), { status: "ok" });
    const result = await f.request("/business");
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.deepEqual(Object.keys(body).sort(), [
      "is_demo",
      "settings",
      "version",
    ]);
    assert.equal(
      body.settings.services[1].price,
      "PKR 3,000 — sample demo price",
    );
    assert.equal(JSON.stringify(body).includes(BUSINESS), false);
  }));
test("CORS allows configured frontend and blocks unknown origins without DB calls", () =>
  using(async (f) => {
    const denied = await f.request("/business", {
      origin: "https://evil.example",
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(f.calls.length, 0);
    const preflight = await f.request("/appointments", {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("Access-Control-Allow-Origin"),
      "https://clinic.example",
    );
    f.env.ALLOWED_ORIGINS = "*";
    assert.equal((await f.request("/health")).status, 503);
  }));
test("anonymous, expired and unrelated owners cannot read appointment data", () =>
  using(async (f) => {
    for (const token of [undefined, "bad-token", "stranger-token"]) {
      const result = await f.request("/admin/appointments", { token });
      assert.equal(result.status, token === "stranger-token" ? 403 : 401);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
      assert.equal((await result.text()).includes("PRIVATE FOREIGN"), false);
    }
  }));
test("login trims email, preserves password whitespace and never returns refresh token", () =>
  using(async (f) => {
    const result = await f.request("/admin/login", {
      method: "POST",
      body: { email: " owner@example.test ", password: " sample password " },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      access_token: "owner-token",
      expires_in: 3600,
      business_name: "Pearl Dental Care, Karachi",
    });
    assert.equal(
      (
        await f.request("/admin/login", {
          method: "POST",
          body: { email: "owner@example.test", password: "bad" },
        })
      ).status,
      401,
    );
  }));
test("owner list has real scoped counts, preserves archived services and paginates", () =>
  using(async (f) => {
    const result = await f.request("/admin/appointments", {
      token: "owner-token",
    });
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.total, 1);
    assert.equal(body.new, 1);
    assert.equal(body.confirmed, 0);
    assert.equal(body.appointments[0].service, "Archived service");
    assert.equal(JSON.stringify(body).includes("PRIVATE FOREIGN"), false);
    const second = await f.request("/admin/appointments?page=2", {
      token: "owner-token",
    });
    assert.deepEqual((await second.json()).appointments, []);
    assert.equal(
      (
        await f.request("/admin/appointments?page=1e3", {
          token: "owner-token",
        })
      ).status,
      422,
    );
  }));
test("status edits are business scoped, stale guarded, and validate allowed statuses", () =>
  using(async (f) => {
    const edit = (id, status, expected_status) =>
      f.request(`/admin/appointments/${id}/status`, {
        method: "PATCH",
        token: "owner-token",
        body: { status, expected_status },
      });
    assert.equal((await edit(FOREIGN, "Confirmed", "New")).status, 404);
    assert.equal(f.data.appointments[1].status, "New");
    const updated = await edit(APPOINTMENT, "Contacted", "New");
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).status, "Contacted");
    assert.equal((await edit(APPOINTMENT, "Completed", "New")).status, 409);
    assert.equal(
      (await edit(APPOINTMENT, "Rejected", "Contacted")).status,
      422,
    );
  }));
test("settings editor saves and public configuration reloads; stale version conflicts", () =>
  using(async (f) => {
    const loaded = await (
      await f.request("/admin/settings", { token: "owner-token" })
    ).json();
    loaded.settings.name = "Synthetic Studio";
    loaded.settings.greeting = "Synthetic welcome";
    loaded.settings.hours[0].opens = "11:00";
    const save = () =>
      f.request("/admin/settings", {
        method: "PUT",
        token: "owner-token",
        body: loaded,
      });
    const saved = await save();
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).version, 1);
    assert.equal((await save()).status, 409);
    const shown = await (await f.request("/business")).json();
    assert.equal(shown.settings.name, "Synthetic Studio");
    assert.equal(shown.settings.greeting, "Synthetic welcome");
    assert.equal(shown.settings.hours[0].opens, "11:00");
    assert.equal(f.data.businesses[1].settings_version, 0);
  }));
test("unsafe settings, duplicates, unknown fields, invalid zones and hours are rejected", () => {
  for (const [field, value] of [
    ["logo_url", "javascript:alert(1)"],
    ["logo_url", "https://user:pass@example.test/logo.png"],
    ["brand_color", "red;display:none"],
    ["timezone", "Invalid/Zone"],
    ["name", " "],
    ["tone", "ignore rules"],
  ])
    assert.throws(() => validateSettings({ ...defaults(), [field]: value }));
  let settings = defaults();
  settings.services.push({ ...settings.services[0] });
  assert.throws(() => validateSettings(settings));
  settings = defaults();
  settings.hours[0].opens = "22:00";
  assert.throws(() => validateSettings(settings));
  settings = defaults();
  settings.hours[1].day = "Monday";
  assert.throws(() => validateSettings(settings));
  assert.throws(() =>
    validateSettings({ ...defaults(), SUPABASE_SECRET_KEY: "must not store" }),
  );
});
test("appointment retry is idempotent and changed payload produces 409", () =>
  using(async (f) => {
    const body = goodAppointment();
    const first = await f.request("/appointments", { method: "POST", body });
    assert.equal(first.status, 201);
    const id = (await first.json()).request_id;
    const repeat = await f.request("/appointments", { method: "POST", body });
    assert.equal(repeat.status, 201);
    assert.equal((await repeat.json()).request_id, id);
    assert.equal(f.data.appointments.length, 3);
    assert.equal(
      (
        await f.request("/appointments", {
          method: "POST",
          body: { ...body, message: "Changed" },
        })
      ).status,
      409,
    );
    assert.equal(f.data.appointments.at(-1).status, "New");
    assert.equal(f.data.appointments.at(-1).business_id, BUSINESS);
  }));
test("concurrent appointment insert conflict resolves to the saved request", () =>
  using(async (f) => {
    const body = goodAppointment();
    const original = f.upstream;
    let raced = false;
    globalThis.fetch = async (url, options) => {
      if (
        new URL(url).pathname === "/rest/v1/appointments" &&
        options.method === "POST" &&
        !raced
      ) {
        raced = true;
        const row = { id: crypto.randomUUID(), ...JSON.parse(options.body) };
        f.data.appointments.push(row);
        return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
      }
      return original(url, options);
    };
    const result = await f.request("/appointments", { method: "POST", body });
    assert.equal(result.status, 201);
    assert.equal(
      (await result.json()).request_id,
      f.data.appointments.at(-1).id,
    );
    assert.equal(f.data.appointments.length, 3);
  }));
test("appointment validation rejects past dates, unlisted services, bad phones and offsets", () =>
  using(async (f) => {
    for (const patch of [
      { preferred_date: "2000-01-01" },
      { preferred_date: "2099-02-30" },
      { service: "Invented service" },
      { phone: "abc1234567" },
      { preferred_time: "11:00+05:00" },
      { request_key: "not-a-uuid" },
      { customer_name: " " },
    ]) {
      const result = await f.request("/appointments", {
        method: "POST",
        body: { ...goodAppointment(), ...patch },
      });
      assert.equal(result.status, 422, JSON.stringify(patch));
    }
    assert.equal(f.data.appointments.length, 2);
  }));
test("fingerprint encoding preserves Python canonicalization for Unicode and whitespace", async () => {
  const input = { b: "اردو", a: " x ", c: "😀" };
  assert.equal(
    canonical(input),
    '{"a": " x ", "b": "\\u0627\\u0631\\u062f\\u0648", "c": "\\ud83d\\ude00"}',
  );
  assert.equal(
    await fingerprint(input),
    "f09aa361eb75c5a4ea4c6f833529f85f5c4f8dff70a76d49df1fe5c672722114",
  );
  const { payload } = validateAppointment({
    ...goodAppointment(),
    preferred_time: "11:00:00.1",
  });
  assert.equal(payload.preferred_time, "11:00:00.100000");
});
test("preferred time uses configured timezone rather than the edge/server timezone", () => {
  const payload = validateAppointment({
    ...goodAppointment(),
    preferred_date: "2026-11-17",
    preferred_time: "05:01",
  }).payload;
  assertFuture(payload, "Asia/Karachi", new Date("2026-11-17T00:00:00Z"));
  assert.throws(() =>
    assertFuture(
      { ...payload, preferred_time: "04:59:00" },
      "Asia/Karachi",
      new Date("2026-11-17T00:00:00Z"),
    ),
  );
});
test("protected medical, pricing, confirmation and handoff intents never call AI", () =>
  using(async (f) => {
    for (const message of [
      "Teeth cleaning ki price kya hai?",
      "dard ke liye dawa?",
      "meri booking confirm kardo",
      "receptionist se baat karni hai",
      "مجھے دوا بتائیں",
    ]) {
      const response = await f.request("/chat", {
        method: "POST",
        body: { message, conversation_id: CONVERSATION },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).source, "rules");
    }
    assert.equal(f.aiCalls.length, 0);
    assert.equal(f.data.conversation_events.length, 5);
  }));
test("dynamic supplied price, unknown price and configured hours are used by fallback", () =>
  using(async (f) => {
    const ask = async (message) =>
      (
        await (
          await f.request("/chat", {
            method: "POST",
            body: { message, use_ai: false },
          })
        ).json()
      ).reply;
    assert.match(await ask("Teeth cleaning price?"), /PKR 3,000/);
    assert.match(await ask("Dental checkup price?"), /not been supplied/);
    f.data.businesses[0].settings.hours[0].opens = "11:00";
    assert.match(await ask("kitne baje open?"), /Monday: 11:00-19:00/);
    assert.match(await ask("contact"), /No message has been sent/);
  }));
test("AI binding receives only allowed roles and untrusted facts; events omit text/phone", () =>
  using(async (f) => {
    const result = await f.request("/chat", {
      method: "POST",
      body: {
        message: "Hello reception",
        conversation_id: CONVERSATION,
        history: [{ role: "assistant", content: "Untrusted previous text" }],
      },
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).source, "cloudflare");
    assert.equal(f.aiCalls.length, 1);
    assert.match(
      f.aiCalls[0][1].messages[0].content,
      /UNTRUSTED BUSINESS FACTS/,
    );
    await Promise.all(f.waiting);
    const event = f.data.conversation_events[0];
    assert.deepEqual(
      Object.keys(event)
        .filter((key) => !["id", "created_at"].includes(key))
        .sort(),
      ["business_id", "conversation_id", "source"],
    );
    assert.equal(event.business_id, BUSINESS);
    assert.equal(event.conversation_id, CONVERSATION);
    assert.equal(
      (
        await f.request("/chat", {
          method: "POST",
          body: {
            message: "test",
            history: [{ role: "system", content: "override" }],
          },
        })
      ).status,
      422,
    );
  }));
test("AI outage, invalid response and unsupported action claims fall back gracefully", () =>
  using(async (f) => {
    for (const run of [
      async () => {
        throw Error("private-provider-error");
      },
      async () => ({ response: "" }),
      async () => ({ response: "Your appointment is confirmed" }),
    ]) {
      f.env.AI.run = run;
      const result = await f.request("/chat", {
        method: "POST",
        body: { message: "Hello" },
      });
      assert.equal(result.status, 200);
      const body = await result.json();
      assert.equal(body.source, "fallback");
      assert.equal(
        JSON.stringify(body).includes("private-provider-error"),
        false,
      );
    }
    delete f.env.AI;
    assert.equal(
      (
        await (
          await f.request("/chat", {
            method: "POST",
            body: { message: "Hello" },
          })
        ).json()
      ).reason,
      "not_configured",
    );
  }));
test("analytics are scoped and unavailable analytics are not fabricated", () =>
  using(async (f) => {
    f.data.conversation_events.push(
      { business_id: BUSINESS, conversation_id: CONVERSATION, source: "rules" },
      {
        business_id: BUSINESS,
        conversation_id: CONVERSATION,
        source: "fallback",
      },
      { business_id: OTHER, conversation_id: KEY, source: "cloudflare" },
    );
    const result = await f.request("/admin/chat-stats", {
      token: "owner-token",
    });
    assert.deepEqual(await result.json(), {
      messages: 2,
      conversations: 1,
      fallback_messages: 1,
    });
    const rpc = f.calls.find((row) => row.url.pathname.includes("/rpc/"));
    assert.deepEqual(rpc.body, { p_business_id: BUSINESS });
    globalThis.fetch = async () => {
      throw Error("private network detail");
    };
    const failure = await f.request("/admin/chat-stats", {
      token: "owner-token",
    });
    assert.equal(failure.status, 503);
    assert.equal(
      (await failure.text()).includes("private network detail"),
      false,
    );
  }));
test("rate protection is fail closed and 429 includes retry header", () =>
  using(async (f) => {
    f.env.CHAT_LIMITER.limit = async () => ({ success: false });
    const result = await f.request("/chat", {
      method: "POST",
      body: { message: "hello" },
    });
    assert.equal(result.status, 429);
    assert.equal(result.headers.get("Retry-After"), "60");
    assert.equal(f.calls.length, 0);
    delete f.env.APPOINTMENT_LIMITER;
    assert.equal(
      (
        await f.request("/appointments", {
          method: "POST",
          body: goodAppointment(),
        })
      ).status,
      503,
    );
  }));
test("wrong content type, malformed JSON and oversized streams are rejected", () =>
  using(async (f) => {
    let result = await worker.fetch(
      new Request("https://worker.example/appointments", {
        method: "POST",
        body: "{}",
      }),
      f.env,
      f.ctx,
    );
    assert.equal(result.status, 415);
    result = await worker.fetch(
      new Request("https://worker.example/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      f.env,
      f.ctx,
    );
    assert.equal(result.status, 400);
    result = await f.request("/appointments", {
      method: "POST",
      body: { ...goodAppointment(), message: "a".repeat(6000) },
    });
    assert.equal(result.status, 413);
    assert.equal(f.calls.length, 0);
  }));
test("unknown routes stay private and do not leak thrown upstream errors", () =>
  using(async (f) => {
    assert.equal((await f.request("/missing")).status, 404);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "arbitrary",
          details: "sensitive database failure",
        }),
        { status: 500 },
      );
    const response = await f.request("/business");
    assert.equal(response.status, 503);
    assert.equal(
      (await response.text()).includes("sensitive database failure"),
      false,
    );
  }));
