import { useEffect, useState } from "react";
import { adminRequest } from "./adminApi";

export default function SettingsEditor({ token, onSessionExpired }) {
  const [document, setDocument] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    adminRequest("/settings", token)
      .then((result) => {
        if (active) {
          setDocument(result);
          setDraft(result.settings);
          setDirty(false);
        }
      })
      .catch((failure) => {
        if (!active) return;
        if (failure.status === 401 || failure.status === 403)
          onSessionExpired(failure.message);
        setError(failure.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, reload, onSessionExpired]);

  function edit(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setNotice("");
  }
  function editRow(key, index, field, value) {
    edit(
      key,
      draft[key].map((row, position) =>
        position === index ? { ...row, [field]: value } : row,
      ),
    );
  }
  function reloadSettings() {
    if (dirty && !window.confirm("Discard unsaved edits and reload settings?"))
      return;
    setLoading(true);
    setError("");
    setNotice("");
    setReload((value) => value + 1);
  }
  async function save(event) {
    event.preventDefault();
    if (saving || !draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest("/settings", token, {
        method: "PUT",
        body: JSON.stringify({ settings: draft, version: document.version }),
      });
      setDocument(result);
      setDraft(result.settings);
      setDirty(false);
      setNotice(
        "Settings saved. Refresh the clinic website or widget to see your updates.",
      );
    } catch (failure) {
      if (failure.status === 401 || failure.status === 403)
        onSessionExpired(failure.message);
      setError(
        failure.status
          ? failure.message
          : "Connection interrupted. Reload settings to check whether changes were saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <p role="status">Loading business settings…</p>;
  if (!draft)
    return (
      <section>
        <p role="alert">{error || "Settings are unavailable."}</p>
        <button onClick={reloadSettings}>Reload settings</button>
      </section>
    );
  const embed = `<script src="${window.location.origin}/embed.js" data-color="${draft.brand_color}" defer></script>`;
  return (
    <section className="settings-editor">
      <div className="owner-toolbar">
        <div>
          <h2>Make reception yours.</h2>
          <p className="owner-muted">
            These public business details power your website, appointment form
            and receptionist.
          </p>
        </div>
        <button type="button" onClick={reloadSettings} disabled={saving}>
          Reload settings
        </button>
      </div>
      {error && (
        <p role="alert" className="owner-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="owner-notice">
          {notice}
        </p>
      )}
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <h3>Business & branding</h3>
          <div className="settings-grid">
            {[
              ["name", "Business name", 120],
              ["industry", "Industry", 80],
              ["phone", "Public phone", 50],
              ["address", "Public address", 300],
              ["timezone", "Timezone (IANA)", 80],
              ["logo_url", "Logo HTTPS image URL", 500],
              ["handoff_contact", "Human reception contact", 200],
            ].map(([key, label, limit]) => (
              <label key={key}>
                {label}
                <input
                  value={draft[key]}
                  maxLength={limit}
                  required={["name", "industry", "timezone"].includes(key)}
                  type={key === "logo_url" ? "url" : "text"}
                  onChange={(event) => edit(key, event.target.value)}
                />
              </label>
            ))}
            <label>
              Brand color
              <input
                type="color"
                value={draft.brand_color}
                onChange={(event) => edit("brand_color", event.target.value)}
              />
            </label>
          </div>
          <label>
            Business introduction
            <textarea
              value={draft.introduction}
              maxLength={800}
              rows={3}
              onChange={(event) => edit("introduction", event.target.value)}
            />
          </label>
          <h3>Receptionist</h3>
          <label>
            Welcome greeting
            <textarea
              value={draft.greeting}
              required
              maxLength={300}
              rows={2}
              onChange={(event) => edit("greeting", event.target.value)}
            />
          </label>
          <label>
            AI tone
            <select
              value={draft.tone}
              onChange={(event) => edit("tone", event.target.value)}
            >
              {["friendly", "professional", "concise"].map((tone) => (
                <option key={tone}>{tone}</option>
              ))}
            </select>
          </label>
          <label>
            Appointment request rules
            <textarea
              value={draft.appointment_rules}
              maxLength={500}
              rows={2}
              onChange={(event) =>
                edit("appointment_rules", event.target.value)
              }
            />
          </label>
          <p className="owner-muted">
            Rules are guidance for requests. A human still confirms bookings.
            Handoff shows the contact you supply and sends no notifications.
          </p>
          <h3>Services & supplied prices</h3>
          {draft.services.map((service, index) => (
            <div className="settings-row" key={index}>
              <label>
                Service name
                <input
                  value={service.name}
                  required
                  maxLength={100}
                  onChange={(event) =>
                    editRow("services", index, "name", event.target.value)
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  value={service.description}
                  maxLength={300}
                  onChange={(event) =>
                    editRow(
                      "services",
                      index,
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Price, including currency
                <input
                  value={service.price}
                  maxLength={80}
                  placeholder="Leave blank if not supplied"
                  onChange={(event) =>
                    editRow("services", index, "price", event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                disabled={draft.services.length <= 1}
                onClick={() =>
                  edit(
                    "services",
                    draft.services.filter((_, position) => position !== index),
                  )
                }
              >
                Remove service
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={draft.services.length >= 20}
            onClick={() =>
              edit("services", [
                ...draft.services,
                { name: "", description: "", price: "" },
              ])
            }
          >
            Add service
          </button>
          <h3>Business hours</h3>
          {draft.hours.map((row, index) => (
            <div className="settings-hours" key={row.day}>
              <strong>{row.day}</strong>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={row.closed}
                  onChange={(event) =>
                    editRow("hours", index, "closed", event.target.checked)
                  }
                />
                Closed
              </label>
              <label>
                Opens
                <input
                  type="time"
                  value={row.opens}
                  disabled={row.closed}
                  required={!row.closed}
                  onChange={(event) =>
                    editRow("hours", index, "opens", event.target.value)
                  }
                />
              </label>
              <label>
                Closes
                <input
                  type="time"
                  value={row.closes}
                  disabled={row.closed}
                  required={!row.closed}
                  onChange={(event) =>
                    editRow("hours", index, "closes", event.target.value)
                  }
                />
              </label>
            </div>
          ))}
          <p className="owner-muted">
            Hours use the configured timezone. Overnight opening hours are not
            supported in this demo.
          </p>
          <h3>Frequently asked questions</h3>
          {draft.faqs.map((faq, index) => (
            <div className="settings-row" key={index}>
              <label>
                Question
                <input
                  value={faq.question}
                  required
                  maxLength={200}
                  onChange={(event) =>
                    editRow("faqs", index, "question", event.target.value)
                  }
                />
              </label>
              <label>
                Answer
                <textarea
                  value={faq.answer}
                  required
                  maxLength={500}
                  onChange={(event) =>
                    editRow("faqs", index, "answer", event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  edit(
                    "faqs",
                    draft.faqs.filter((_, position) => position !== index),
                  )
                }
              >
                Remove FAQ
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={draft.faqs.length >= 20}
            onClick={() =>
              edit("faqs", [...draft.faqs, { question: "", answer: "" }])
            }
          >
            Add FAQ
          </button>
          <div className="settings-save">
            <button type="submit" disabled={!dirty}>
              {saving ? "Saving…" : "Save business settings"}
            </button>
            <span>
              {dirty ? "Unsaved changes" : "All loaded changes saved"}
            </span>
          </div>
        </fieldset>
      </form>
      <h3>Install reception on another website</h3>
      <p className="owner-muted">
        After this frontend is deployed, replace the localhost script address
        with its public HTTPS address. This widget uses this deployment's
        business configuration.
      </p>
      <pre className="embed-code">
        <code>{embed}</code>
      </pre>
    </section>
  );
}
