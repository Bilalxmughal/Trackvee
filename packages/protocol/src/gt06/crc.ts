// CRC-16/IBM used by GT06 protocol
export function crc16Gt06(buf: Buffer, start: number, end: number): number {
  let crc = 0xFFFF;
  for (let i = start; i < end; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xA001;
      } else {
        crc >>>= 1;
      }
    }
  }
  return crc & 0xFFFF;
}
