/**
 * GT06 CRC-ITU (CRC-16/X-25): reflected polynomial 0x8408,
 * initial value 0xFFFF and final XOR 0xFFFF.
 * `end` is exclusive; callers pass bytes from the length field through serial.
 */
export function crc16Gt06(buf: Buffer, start: number, end: number): number {
  let crc = 0xFFFF;
  for (let i = start; i < end; i++) {
    crc ^= buf[i]!;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0x8408) : (crc >>> 1);
    }
  }
  return (crc ^ 0xFFFF) & 0xFFFF;
}
