import test from 'node:test';
import assert from 'node:assert/strict';
import { crc16Gt06 } from '../dist/gt06/crc.js';

const capturedFrames = [
  // Captured GT06 login, heartbeat, and GPS frames from the production device.
  '78780d0103523120949732890031da5b0d0a',
  '78780a13440604000200a994960d0a',
  '78781f121a091d0a2b37c60361a54907fa4ff0001404019a0b65aa004299009158360d0a',
  '78781f121a091d0b080cc60361ac4f07fa5104189405019a0b65aa004299009e40f50d0a',
];

function receivedCrc(frame) {
  const endIndex = frame[2] + 3;
  return (frame[endIndex - 2] << 8) | frame[endIndex - 1];
}

test('GT06 CRC matches captured production login, heartbeat, and GPS frames', () => {
  for (const hex of capturedFrames) {
    const frame = Buffer.from(hex, 'hex');
    const endIndex = frame[2] + 3;
    assert.equal(frame[endIndex], 0x0d, 'frame has GT06 end marker');
    assert.equal(frame[endIndex + 1], 0x0a, 'frame has GT06 end marker');
    assert.equal(crc16Gt06(frame, 2, endIndex - 2), receivedCrc(frame), hex);
  }
});

test('GT06 CRC changes when a covered byte is corrupted', () => {
  const frame = Buffer.from(capturedFrames[2], 'hex');
  const endIndex = frame[2] + 3;
  frame[19] ^= 1;
  assert.notEqual(crc16Gt06(frame, 2, endIndex - 2), receivedCrc(frame));
});
