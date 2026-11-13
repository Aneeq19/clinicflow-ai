import { useState } from 'react'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [reply, setReply] = useState(
    'Assalam o Alaikum! Pearl Dental Care demo mein welcome. Choose an option below.'
  )

  const panelStyle = {
    position: 'fixed',
    right: 16,
    bottom: 88,
    width: 'min(340px, calc(100vw - 32px))',
    maxHeight: '70dvh',
    overflowY: 'auto',
    background: '#ffffff',
    color: '#163a35',
    border: '1px solid #d8e5dd',
    borderRadius: 18,
    boxShadow: '0 12px 40px #123f3826',
    textAlign: 'left',
    fontFamily: 'Arial, sans-serif',
    zIndex: 1000,
  }

  const optionStyle = {
    padding: '10px 12px',
    border: '1px solid #bccfc5',
    borderRadius: 10,
    background: '#f7f8f3',
    color: '#163a35',
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
  }

  function openAppointmentForm() {
    const formSection = document.getElementById('appointment')

    if (formSection) {
      setIsOpen(false)
      formSection.scrollIntoView({ behavior: 'smooth' })
      formSection.querySelector('input')?.focus({
        preventScroll: true,
      })
    } else {
      setReply('Appointment form is unavailable on this page.')
    }
  }

  return (
    <>
      {isOpen && (
        <section
          id="receptionist-panel"
          aria-labelledby="receptionist-title"
          style={panelStyle}
        >
          <header
            style={{
              padding: 18,
              background: '#123f38',
              color: 'white',
            }}
          >
            <strong id="receptionist-title">
              Pearl reception
            </strong>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>
              Fictional demo · Quick answers
            </p>
          </header>

          <div style={{ padding: 18 }}>
            <p
              role="status"
              style={{ lineHeight: 1.6, marginTop: 0 }}
            >
              {reply}
            </p>

            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                style={optionStyle}
                onClick={() =>
                  setReply(
                    'Sample services: Dental checkup, Teeth cleaning, and Restorative care. Aap kis service ke liye request karna chahte hain?'
                  )
                }
              >
                Services / Treatments
              </button>

              <button
                type="button"
                style={optionStyle}
                onClick={() =>
                  setReply(
                    'Sample hours: Monday–Saturday, 10 AM–7 PM Karachi time. Sunday closed. Ye fictional demo timings hain.'
                  )
                }
              >
                Hours / Timings
              </button>

              <button
                type="button"
                style={optionStyle}
                onClick={() =>
                  setReply(
                    'Prices have not been supplied for this demo. Charges ki information receptionist se confirm karni hogi.'
                  )
                }
              >
                Prices / Charges
              </button>

              <button
                type="button"
                style={optionStyle}
                onClick={openAppointmentForm}
              >
                Request appointment
              </button>

              <button
                type="button"
                style={optionStyle}
                onClick={() =>
                  setReply(
                    'Human handoff contact has not been configured for this demo. Abhi kisi receptionist ko notification nahi bheji gayi.'
                  )
                }
              >
                Talk to reception
              </button>
            </div>

            <p style={{ fontSize: 12, lineHeight: 1.5 }}>
              Use sample details only. Appointment requests require
              reception confirmation. For medical advice, consult a
              qualified clinician.
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="receptionist-panel"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 20,
          padding: '15px 20px',
          border: 0,
          borderRadius: 30,
          background: '#123f38',
          color: 'white',
          boxShadow: '0 6px 20px #123f3833',
          cursor: 'pointer',
          font: '600 15px Arial, sans-serif',
          zIndex: 1000,
        }}
      >
        {isOpen ? 'Close reception' : 'Chat with reception'}
      </button>
    </>
  )
}