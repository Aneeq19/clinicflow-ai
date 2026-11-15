import { useRef, useState } from "react";
import { publicRequest } from "./api";

export default function AppointmentForm({ business }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestKey = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    setBusy(true);
    setMessage("Sending your request…");
    try {
      const result = await publicRequest("/appointments", {
        method: "POST",
        body: JSON.stringify({
          customer_name: fields.get("name"),
          phone: fields.get("phone"),
          service: fields.get("service"),
          preferred_date: fields.get("date"),
          preferred_time: fields.get("time"),
          message: fields.get("message") || "",
          request_key: requestKey.current,
        }),
      });
      setMessage(result.message);
      form.reset();
      requestKey.current = null;
    } catch (failure) {
      setMessage(
        failure.name === "Error"
          ? failure.message
          : "Connection interrupted. You can retry the same request without changing the form.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="appointment-form"
      onSubmit={submit}
      onChange={() => {
        requestKey.current = null;
        setMessage("");
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Full name
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            placeholder="Sample customer"
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={7}
            maxLength={30}
            placeholder="Use a sample number"
          />
        </label>
        <label className="form-wide">
          Requested service
          <select name="service" defaultValue="" required>
            <option value="" disabled>
              Choose a service
            </option>
            {business.services.map((service) => (
              <option key={service.name}>{service.name}</option>
            ))}
          </select>
        </label>
        <label>
          Preferred date
          <input name="date" type="date" required />
        </label>
        <label>
          Preferred time
          <input name="time" type="time" required />
        </label>
        <label className="form-wide">
          Optional message
          <textarea
            name="message"
            rows={3}
            maxLength={500}
            placeholder="Sample details only. Avoid medical information."
          />
        </label>
        <p className="form-wide muted">
          Times use {business.timezone}. {business.appointment_rules}
        </p>
        <button className="primary-button form-wide" type="submit">
          {busy ? "Sending…" : "Send appointment request"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </fieldset>
      <p role="status" className="form-status">
        {message}
      </p>
    </form>
  );
}
