import useBusiness from "./useBusiness";
import ChatWidget from "./ChatWidget";
import AppointmentForm from "./AppointmentForm";
import "./App.css";

function PearlMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M12 11C18 7 21 12 24 12S31 7 36 11C44 19 34 39 31 39S29 25 24 25S20 39 17 39S4 19 12 11Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m21 8 3-5 3 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const { business, error } = useBusiness();
  if (!business)
    return (
      <main className="loading-page">
        <h1>ClinicFlow AI</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Preparing your reception…"}
        </p>
        {error && (
          <button onClick={() => window.location.reload()}>Refresh page</button>
        )}
      </main>
    );
  return (
    <div className="clinic-site" style={{ "--brand": business.brand_color }}>
      <div className="demo-strip">
        Fictional business demonstration · Sample details only{" "}
        <a href="/admin">Owner dashboard ↗</a>
      </div>
      <header className="site-header wrap">
        <a className="brand" href="#home">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <PearlMark />
          )}
          <span>
            {business.name}
            <small>{business.industry}</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#visit">Plan your visit</a>
        </nav>
        <a className="outline-button" href="#appointment">
          Request a visit ↗
        </a>
      </header>
      <main id="home">
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> A WARM WELCOME STARTS HERE
            </p>
            <h1>
              A little more care.
              <br />
              <em>A little less worry.</em>
            </h1>
            <p className="hero-intro">{business.introduction}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#appointment">
                Plan your next visit <span>↗</span>
              </a>
              <a href="#services" className="text-link">
                Explore our services ↓
              </a>
            </div>
            <p className="hero-note">
              Ask reception in English, Urdu or Roman Urdu.
            </p>
          </div>
          <div
            className="hero-art"
            aria-label="Illustrated dental reception demonstration"
          >
            <span className="art-orbit" />
            <div className="tooth-art">
              <PearlMark />
            </div>
            <div className="art-label">
              <span className="status-dot" /> YOUR NEXT VISIT, SIMPLIFIED
            </div>
            <div className="reception-card">
              <span className="mini-avatar">P</span>
              <div>
                <strong>A reception that listens.</strong>
                <p>Questions, services & appointment requests.</p>
              </div>
              <span>↗</span>
            </div>
            <p className="art-caption">
              Thoughtful care begins with a conversation.
            </p>
          </div>
        </section>
        <div className="feature-band">
          <div className="wrap feature-grid">
            <span>
              01 <strong>Explore your options</strong>
            </span>
            <span>
              02 <strong>Ask reception</strong>
            </span>
            <span>
              03 <strong>Request a time that suits you</strong>
            </span>
          </div>
        </div>
        <section id="services" className="wrap section-space">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OUR SAMPLE SERVICES</p>
              <h2>Care for your next chapter.</h2>
            </div>
            <p>
              Explore the services available in this demonstration. Reception
              can help with your next step.
            </p>
          </div>
          <div className="service-grid">
            {business.services.map((service, index) => (
              <article className="service-card" key={service.name}>
                <span className="service-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <strong className="service-price">
                  {service.price || "Ask reception about pricing"}
                </strong>
                <a href="#appointment" aria-label={`Request ${service.name}`}>
                  Request a visit <span>↗</span>
                </a>
              </article>
            ))}
          </div>
        </section>
        <section id="about" className="about-section">
          <div className="wrap about-grid">
            <div>
              <p className="eyebrow">GOOD CONVERSATIONS. CLEAR NEXT STEPS.</p>
              <h2>
                Your questions
                <br />
                deserve a thoughtful answer.
              </h2>
            </div>
            <div>
              <p>{business.introduction}</p>
              <p className="muted">
                Our demo receptionist helps you explore business information and
                submit appointment requests. A human reviews and confirms every
                appointment.
              </p>
              <a className="text-link" href="#appointment">
                Start with a request ↗
              </a>
            </div>
          </div>
        </section>
        <section id="visit" className="wrap section-space visit-grid">
          <div>
            <p className="eyebrow">PLAN YOUR VISIT</p>
            <h2>
              A time to fit
              <br />
              your day.
            </h2>
            <p className="muted">Business timezone · {business.timezone}</p>
            <dl className="hours-list">
              {business.hours.map((row) => (
                <div key={row.day}>
                  <dt>{row.day}</dt>
                  <dd>
                    {row.closed ? "Closed" : `${row.opens} – ${row.closes}`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="location-card">
            <p className="eyebrow">FIND & CONTACT US</p>
            <h3>{business.name}</h3>
            <p>
              {business.address ||
                "An exact address has not been supplied for this fictional demo."}
            </p>
            <p>{business.phone || "A phone number has not been supplied."}</p>
            {business.handoff_contact && (
              <p>Reception · {business.handoff_contact}</p>
            )}
            <div className="location-illustration" aria-hidden="true">
              <span>⌖</span>
              <p>Fictional demo location</p>
            </div>
          </div>
        </section>
        {business.faqs.length > 0 && (
          <section className="wrap faq-section">
            <p className="eyebrow">A FEW HELPFUL ANSWERS</p>
            <h2>Before your visit.</h2>
            {business.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </section>
        )}
        <section id="appointment" className="appointment-section">
          <div className="wrap booking-grid">
            <div>
              <p className="eyebrow">LET'S TAKE THE NEXT STEP</p>
              <h2>
                Your next visit
                <br />
                starts here.
              </h2>
              <p>
                Tell reception your preferred service and time. This is a
                request. Reception must confirm availability.
              </p>
              <div className="booking-note">
                <strong>A note about this demo</strong>
                <p>
                  Use fictional names and phone numbers. Please keep medical
                  details out of the form and chat.
                </p>
              </div>
            </div>
            <div className="booking-card">
              <h3>Request an appointment</h3>
              <AppointmentForm business={business} />
            </div>
          </div>
        </section>
      </main>
      <footer className="wrap site-footer">
        <div className="brand">
          <PearlMark />
          <span>
            {business.name}
            <small>Powered by ClinicFlow AI</small>
          </span>
        </div>
        <p>Fictional demo · Requests require human confirmation.</p>
        <a href="/admin">Owner login ↗</a>
      </footer>
      <ChatWidget business={business} />
    </div>
  );
}
