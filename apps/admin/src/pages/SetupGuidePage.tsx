import { IconBuildingStore, IconCar, IconDeviceMobile, IconWifi, IconCheck, IconChevronRight } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';

const STEPS = [
  {
    icon: IconBuildingStore,
    title: 'Add Client (Organization)',
    description: 'Create a client account for the business that will use the tracking system.',
    steps: [
      'Go to Clients in the sidebar',
      'Click "Add Client"',
      'Enter company name and set status to Active',
    ],
    link: '/clients',
    linkLabel: 'Go to Clients',
  },
  {
    icon: IconCar,
    title: 'Add Vehicle',
    description: 'Register each vehicle that will be tracked. Assign it to the client.',
    steps: [
      'Go to Vehicles in the sidebar',
      'Click "Add Vehicle"',
      'Enter license plate, make, model',
      'Select the client organization',
    ],
    link: '/vehicles',
    linkLabel: 'Go to Vehicles',
  },
  {
    icon: IconDeviceMobile,
    title: 'Add GPS Device & Link to Vehicle',
    description: 'Register the ATS-GO tracker by its IMEI number and link it to the vehicle.',
    steps: [
      'Go to Devices in the sidebar',
      'Click "Add Device"',
      'Enter the 15-digit IMEI number (printed on device)',
      'Enter SIM number (Ufone)',
      'Select the vehicle to link',
    ],
    link: '/devices',
    linkLabel: 'Go to Devices',
  },
  {
    icon: IconWifi,
    title: 'Configure Device to Send Data',
    description: 'Send SMS commands to the ATS-GO device so it connects to YoTrack server.',
    steps: [
      'Send this SMS to device SIM number:',
      'SERVER,1,140.245.61.83,5023,0#',
      'Then confirm with: STATUS#',
      'Device will reply with OK and start sending GPS data',
      'Check Telemetry page — data appears within 1-2 minutes',
    ],
    link: '/telemetry',
    linkLabel: 'View Telemetry',
    highlight: true,
  },
];

const SMS_COMMANDS = [
  { cmd: 'SERVER,1,140.245.61.83,5023,0#', desc: 'Point device to YoTrack server' },
  { cmd: 'STATUS#', desc: 'Check device status and connection' },
  { cmd: 'RESET#', desc: 'Restart device (if needed)' },
  { cmd: 'PARAM#', desc: 'View all current device settings' },
  { cmd: 'INTERVAL,0,30,0#', desc: 'Report GPS every 30 seconds (while moving)' },
];

export default function SetupGuidePage() {
  return (
    <div>
      <PageHeader title="Setup Guide" />

      <div style={{ padding: '0 24px 40px' }}>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                style={{
                  border: `1px solid ${step.highlight ? 'rgba(220,38,38,0.3)' : 'var(--border)'}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: step.highlight ? 'rgba(220,38,38,0.03)' : 'var(--bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px' }}>
                  {/* Step number + icon */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: step.highlight ? '#dc2626' : 'var(--bg3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={17} color={step.highlight ? '#fff' : '#dc2626'} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Step {i + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>{step.description}</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      {step.steps.map((s, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          {step.highlight && s.includes('#') ? (
                            // SMS command — show as code block
                            <code style={{
                              display: 'block', background: '#111', color: '#22c55e',
                              padding: '5px 10px', borderRadius: 5, fontSize: 12,
                              fontFamily: 'monospace', letterSpacing: 0.5, width: '100%',
                            }}>
                              {s}
                            </code>
                          ) : (
                            <>
                              <IconCheck size={13} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
                              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{s}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <a
                      href={step.link}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 500, color: '#dc2626',
                        textDecoration: 'none',
                      }}
                    >
                      {step.linkLabel} <IconChevronRight size={13} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SMS Commands Reference */}
        <div style={{ maxWidth: 720, marginTop: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            ATS-GO SMS Command Reference
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>SMS Command</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {SMS_COMMANDS.map((c, i) => (
                  <tr key={i} style={{ borderBottom: i < SMS_COMMANDS.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <code style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#dc2626', background: 'rgba(220,38,38,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                        {c.cmd}
                      </code>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 12.5 }}>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            Send SMS from any phone to the SIM number inside the ATS-GO device.
            Device will reply to confirm. Default password may be required — check your device manual.
          </div>
        </div>

        {/* Server info box */}
        <div style={{ maxWidth: 720, marginTop: 24, padding: '14px 18px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>Server Connection Details</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Server IP</div>
              <code style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text)' }}>140.245.61.83</code>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>TCP Port</div>
              <code style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text)' }}>5023</code>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Protocol</div>
              <code style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text)' }}>AT06 / AOT06 ASCII</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
