import { useState } from 'react'
import ChatWidget from './ChatWidget'

const services = [
  {
    name: 'Dental checkup',
    description: 'Explore what a routine dental visit can cover.',
  },
  {
    name: 'Teeth cleaning',
    description: 'Learn about a professional cleaning appointment.',
  },
  {
    name: 'Restorative care',
    description: 'Explore sample services such as fillings and crowns.',
  },
]

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  padding: 12,
  border: '1px solid #bccfc5',
  borderRadius: 8,
  background: 'white',
  color: '#163a35',
  font: 'inherit',
}

export default function App() {
  const [submitMessage, setSubmitMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleAppointmentSubmit(event) {
    event.preventDefault()

    if (isSubmitting) return

    const form = event.currentTarget
    const fields = new FormData(form)

    const appointment = {
      customer_name: fields.get('name'),
      phone: fields.get('phone'),
      service: fields.get('service'),
      preferred_date: fields.get('date'),
      preferred_time: fields.get('time'),
      message: fields.get('message') || '',
    }

    setIsSubmitting(true)
    setSubmitMessage('Sending your request…')

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/appointments',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(appointment),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map((error) => error.msg).join(' ')
          : result.detail

        setSubmitMessage(detail || 'Could not submit your request.')
        return
      }

      setSubmitMessage(result.message)
      form.reset()
    } catch {
      setSubmitMessage(
        'Connection interrupted. Reception should check whether your request arrived before you retry.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        background: '#f7f8f3',
        color: '#163a35',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <header
        style={{
          background: '#123f38',
          color: 'white',
          padding: '16px 6%',
        }}
      >
        <strong>Pearl Dental Care</strong>
        <span style={{ marginLeft: 12, color: '#c7e7db' }}>
          Fictional demo
        </span>
      </header>

      <main
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '48px 20px',
        }}
      >
        <section
          style={{
            background: '#e0efe7',
            borderRadius: 24,
            padding: 'clamp(24px, 6vw, 72px)',
          }}
        >
          <p>PEARL DENTAL CARE · KARACHI</p>

          <h1
            style={{
              fontSize: 'clamp(2rem, 6vw, 4rem)',
              lineHeight: 1.1,
              margin: '16px 0',
            }}
          >
            Plan your next dental visit.
          </h1>

          <p>
            Explore dental services and request a visit in this
            ClinicFlow AI demonstration.
          </p>

          <a
            href="#appointment"
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '12px 20px',
              borderRadius: 10,
              background: '#123f38',
              color: 'white',
            }}
          >
            Request an appointment
          </a>
        </section>

        <section id="services" style={{ marginTop: 40 }}>
          <h2>Sample services</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              gap: 16,
            }}
          >
            {services.map((service) => (
              <article
                key={service.name}
                style={{
                  background: 'white',
                  padding: 20,
                  borderRadius: 16,
                  border: '1px solid #d8e5dd',
                }}
              >
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2>Sample clinic hours</h2>
          <p>Monday–Saturday · 10:00 AM–7:00 PM · Karachi time</p>
          <p>Sunday · Closed</p>
        </section>

        <section id="appointment" style={{ marginTop: 40 }}>
          <h2>Request an appointment</h2>
          <p>
            Fictional demo. Use sample details only. Requests are saved
            for testing and require reception confirmation.
          </p>

          <form
            onSubmit={handleAppointmentSubmit}
            style={{
              maxWidth: 480,
              margin: '24px auto',
              textAlign: 'left',
            }}
          >
            <fieldset
              disabled={isSubmitting}
              style={{
                border: 0,
                padding: 0,
                margin: 0,
                minWidth: 0,
                display: 'grid',
                gap: 16,
              }}
            >
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  style={inputStyle}
                />
              </label>

              <label>
                Phone number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  minLength={7}
                  maxLength={30}
                  required
                  style={inputStyle}
                />
              </label>

              <label>
                Service
                <select
                  name="service"
                  defaultValue=""
                  required
                  style={inputStyle}
                >
                  <option value="" disabled>
                    Choose a service
                  </option>
                  {services.map((service) => (
                    <option key={service.name} value={service.name}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Preferred date
                <input
                  name="date"
                  type="date"
                  required
                  style={inputStyle}
                />
              </label>

              <label>
                Preferred time (Karachi time)
                <input
                  name="time"
                  type="time"
                  required
                  style={inputStyle}
                />
              </label>

              <label>
                Optional message
                <textarea
                  name="message"
                  rows={3}
                  maxLength={500}
                  style={inputStyle}
                />
              </label>

              <button
                type="submit"
                style={{
                  padding: 14,
                  border: 0,
                  borderRadius: 10,
                  background: '#123f38',
                  color: 'white',
                  font: 'inherit',
                  cursor: isSubmitting ? 'wait' : 'pointer',
                }}
              >
                {isSubmitting ? 'Sending…' : 'Request appointment'}
              </button>
            </fieldset>

            <p role="status">{submitMessage}</p>
          </form>
        </section>
      </main>
       <ChatWidget />
    </div>
  )
}