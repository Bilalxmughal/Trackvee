export type At06AlarmCode =
  | '01' | '49' | '09' | '10' | '11' | '13'
  | '16' | '42' | '43' | '50' | '51' | '52'
  | '53' | '54' | '55' | '56' | '57' | '58'
  | '59' | '60' | '61' | '63' | '64' | '65'
  | '66' | '88' | '91' | '92' | '99' | 'AA';

export const AT06_ALARM_MAP: Record<string, string> = {
  '01': 'sos',
  '49': 'button_a',
  '09': 'auto_shutdown',
  '10': 'low_battery',
  '11': 'overspeed',
  '13': 'overspeed_recover',
  '16': 'gps_antenna_cut',
  '42': 'geofence_exit',
  '43': 'geofence_enter',
  '50': 'input1_open',
  '51': 'input1_close',
  '52': 'input2_open',
  '53': 'input2_close',
  '58': 'gps_antenna_recover',
  '59': 'gps_antenna_cut',
  '60': 'charge_start',
  '61': 'charge_end',
  '88': 'heartbeat',
  '91': 'sleep',
  '92': 'wake',
  '99': 'gsm_jamming',
  'AA': 'interval',
};

export interface At06ParsedFrame {
  imei: string;
  alarmCode: string;
  alarmLabel: string;
  timestamp: Date;
  gpsValid: boolean;
  latitude: number;
  longitude: number;
  speedKnots: number;
  speedKmh: number;
  heading: number;
  hdop: number;
  status: At06Status;
  voltage: At06Voltage;
  lacci: At06Lacci;
  serial: number;
  rawChecksum: string;
  checksumValid: boolean;
  rawData: string;
}

export interface At06Status {
  gpsAntenna: boolean;
  externalPower: boolean;
  input1: boolean;
  input2: boolean;
  input3: boolean;
  input4: boolean;
  output1: boolean;
  output2: boolean;
}

export interface At06Voltage {
  charging: boolean;
  batteryVolts: number;
  inputVolts: number;
}

export interface At06Lacci {
  locationAreaCode: string;
  cellId: string;
}

export interface At06ParseError {
  reason: string;
  rawData: string;
}

export type At06ParseResult =
  | { ok: true; frame: At06ParsedFrame }
  | { ok: false; error: At06ParseError };
