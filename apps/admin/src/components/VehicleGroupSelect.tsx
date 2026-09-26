import React from 'react';

export interface VehicleGroupItem { id: string; name: string; imeis: string[]; }
export type VehicleDeviceMap = Map<string, { plate: string | null; displayId: number | null }>;

function fmtPlate(dv: { plate: string | null; displayId: number | null } | undefined, imei: string): string {
  if (!dv) return imei.slice(-4);
  if (dv.plate) return dv.plate;
  return dv.displayId ? `#${dv.displayId}` : imei.slice(-4);
}

interface Props {
  allImeis: string[];
  deviceMap: VehicleDeviceMap;
  selected: Set<string>;
  onToggle: (imei: string) => void;
  dark?: boolean;
  groups?: VehicleGroupItem[];
  excludeGroupId?: string;
}

export default function VehicleGroupSelect({ allImeis: _allImeis, deviceMap, selected, onToggle, dark = false, groups = [], excludeGroupId }: Props) {
  const allImeis = _allImeis ?? [];
  const activeGroups = groups.filter(g => g.id !== excludeGroupId);
  const groupedSet = new Set(activeGroups.flatMap(g => g.imeis ?? []));
  const ungrouped = allImeis.filter(i => !groupedSet.has(i));

  const sections: { title?: string; imeis: string[] }[] = [];
  activeGroups.forEach(g => {
    const gImeis = (g.imeis ?? []).filter(i => allImeis.includes(i));
    if (gImeis.length > 0) sections.push({ title: g.name, imeis: gImeis });
  });
  if (ungrouped.length > 0) sections.push({ imeis: ungrouped });
  if (sections.length === 0) sections.push({ imeis: allImeis });

  return (
    <div style={{ padding: '4px 4px' }}>
      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: si < sections.length - 1 ? 8 : 0 }}>
          {section.title && (
            <div style={{ padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: dark ? '#555' : '#bbb', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {section.title}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {section.imeis.map(imei => (
              <VehicleItem key={imei} imei={imei} deviceMap={deviceMap} checked={selected.has(imei)} onToggle={onToggle} dark={dark} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleItem({ imei, deviceMap, checked, onToggle, dark }: {
  imei: string; deviceMap: VehicleDeviceMap; checked: boolean; onToggle: (imei: string) => void; dark: boolean;
}) {
  const plate = fmtPlate(deviceMap.get(imei), imei);
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', borderRadius: 4, background: 'transparent', userSelect: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dark ? '#1e1e1e' : '#f9fafb'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <input type="checkbox" checked={checked} onChange={() => onToggle(imei)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{ flexShrink: 0, width: 15, height: 15, borderRadius: 3, border: checked ? '1.5px solid #dc2626' : `1.5px solid ${dark ? '#555' : '#d1d5db'}`, background: checked ? '#dc2626' : (dark ? '#2a2a2a' : '#fff'), display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, border-color 0.1s' }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? '#dc2626' : (dark ? '#e5e5e5' : '#333'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plate}</span>
    </label>
  );
}
