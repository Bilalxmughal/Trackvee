import { useState } from 'react';
import { IconBuildingStore, IconCar, IconDeviceMobile, IconWifi, IconCheck, IconChevronRight, IconCopy, IconCircleCheck } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';

const STEPS = [
  {
    icon: IconBuildingStore,
    color: '#3b82f6',
    title: 'Add Client',
    subtitle: 'Organization setup',
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
    color: '#8b5cf6',
    title: 'Add Vehicle',
    subtitle: 'Fleet registration',
    description: 'Register each vehicle that will be tracked and assign it to the client.',
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
    color: '#f59e0b',
    title: 'Add GPS Device',
    subtitle: 'Link to vehicle',
    description: 'Register the ATS-GO tracker by IMEI number and link it to the vehicle.',
    steps: [
      'Go to Devices in the sidebar',
      'Click "Add Device"',
      'Enter the 15-digit IMEI (printed on device)',
      'Enter SIM number (Ufone)',
      'Select the vehicle to link',
    ],
    link: '/devices',
    linkLabel: 'Go to Devices',
  },
  {
    icon: IconWifi,
    color: '#dc2626',
    title: 'Configure Device',
    subtitle: 'Send SMS commands',
    description: 'Send SMS commands to the ATS-GO device so it connects to YoTrack server.',
    steps: [
      'SERVER,1,140.245.61.83,5023,0#',
      'STATUS#',
    ],
    link: '/telemetry',
    linkLabel: 'View Telemetry',
    isSms: true,
  },
];

const SMS_COMMANDS = [
  { cmd: 'SERVER,1,140.245.61.83,5023,0#', desc: 'Point device to YoTrack server' },
  { cmd: 'STATUS#', desc: 'Check device status and connection' },
  { cmd: 'RESET#', desc: 'Restart device (if needed)' },
  { cmd: 'PARAM#', desc: 'View all current device settings' },
  { cmd: 'INTERVAL,0,30,0#', desc: 'Report GPS every 30 seconds (while moving)' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} title="Copy" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: copied ? '#22c55e' : '#9ca3af', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
      {copied ? <IconCircleCheck size={12} /> : <IconCopy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function SetupGuidePage() {
  return (
    <div>
      <PageHeader title="Setup Guide" />

      <div style={{ padding: '0 24px 48px' }}>

        {/* Step progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 760, marginBottom: 32, marginTop: 4 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: `0 0 0 4px ${step.color}22` }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: step.color, whiteSpace: 'nowrap' }}>{step.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${step.color}, ${STEPS[i + 1].color})`, margin: '0 4px', marginBottom: 16, opacity: 0.35 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg)' }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)', background: `${step.color}08` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: step.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>Step {i + 1}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{step.subtitle}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', marginTop: 1 }}>{step.title}</div>
                  </div>
                  <a href={step.link} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: step.color, textDecoration: 'none', padding: '5px 12px', border: `1px solid ${step.color}40`, borderRadius: 6, background: `${step.color}08`, flexShrink: 0 }}>
                    {step.linkLabel} <IconChevronRight size={12} />
                  </a>
                </div>

                {/* Card body */}
                <div style={{ padding: '14px 20px' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>{step.description}</p>

                  {step.isSms ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Send these SMS commands in order:</div>
                      {step.steps.map((s, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', borderRadius: 7, padding: '8px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', minWidth: 16 }}>{j + 1}.</span>
                          <code style={{ flex: 1, fontSize: 12.5, fontFamily: 'monospace', color: '#22c55e', letterSpacing: 0.4 }}>{s}</code>
                          <CopyButton text={s} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {step.steps.map((s, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${step.color}18`, border: `1.5px solid ${step.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <IconCheck size={10} color={step.color} />
                          </div>
                          <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SMS Commands Reference */}
        <div style={{ maxWidth: 760, marginTop: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)', marginBottom: 12 }}>
            ATS-GO SMS Command Reference
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#111', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#ff5f56', '#ffbd2e', '#27c93f'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
              </div>
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>SMS Terminal</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#111' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Command</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Action</th>
                  <th style={{ padding: '8px 16px', width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {SMS_COMMANDS.map((c, i) => (
                  <tr key={i} style={{ borderBottom: i < SMS_COMMANDS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#22c55e' }}>{c.cmd}</code>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12 }}>{c.desc}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <CopyButton text={c.cmd} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
            Send SMS from any phone to the SIM number inside the ATS-GO device. Device will reply to confirm.
          </div>
        </div>

        {/* Server info */}
        <div style={{ maxWidth: 760, marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Server IP', value: '140.245.61.83' },
            { label: 'TCP Port', value: '5023' },
            { label: 'Protocol', value: 'AT06 / AOT06 ASCII' },
          ].map(item => (
            <div key={item.label} style={{ padding: '14px 16px', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, background: 'rgba(220,38,38,0.03)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 5 }}>{item.label}</div>
              <code style={{ fontSize: 14, fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>{item.value}</code>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
