const CRC16_TABLE = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
    table.push(crc);
  }
  return table;
})();

export function crc16Modbus(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i) & 0xff;
    const index = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ (CRC16_TABLE[index] ?? 0);
  }
  return crc;
}

export function crc16ModbusHex(data: string): string {
  return crc16Modbus(data).toString(16).toUpperCase().padStart(4, '0');
}
