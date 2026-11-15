import { useState } from "react";
import useBusiness from "./useBusiness";
import ChatWidget from "./ChatWidget";
import AppointmentForm from "./AppointmentForm";
import "./App.css";

export default function EmbeddedReception() {
  const { business, error } = useBusiness();
  const [booking, setBooking] = useState(false);
  if (!business)
    return (
      <p role={error ? "alert" : "status"}>{error || "Loading reception…"}</p>
    );
  return (
    <div
      className="widget-page"
      style={{ "--brand": business.brand_color, overflowY: "auto" }}
    >
      {booking ? (
        <>
          <button onClick={() => setBooking(false)}>← Back to reception</button>
          <div className="booking-card">
            <h2>Request a visit</h2>
            <p className="muted">Fictional demo · Sample details only</p>
            <AppointmentForm business={business} />
          </div>
        </>
      ) : (
        <ChatWidget
          business={business}
          embedded
          onAppointment={() => setBooking(true)}
        />
      )}
    </div>
  );
}
