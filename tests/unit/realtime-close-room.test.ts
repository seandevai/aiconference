import { describe, expect, it, vi } from 'vitest';

// vi.mock sale in cima al file: i finti vanno creati con vi.hoisted.
const { deleteRoom, RoomServiceClient } = vi.hoisted(() => {
  const deleteRoom = vi.fn(async () => {});
  const RoomServiceClient = vi.fn(function () {
    return { deleteRoom };
  });
  return { deleteRoom, RoomServiceClient };
});

vi.mock('livekit-server-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-server-sdk')>()),
  RoomServiceClient,
}));

const { closeRoom } = await import('@omnicanvas/realtime/server');

describe('closeRoom', () => {
  it('deletes the realtime room with the server credentials', async () => {
    await closeRoom('room-1', { url: 'ws://localhost:7880', apiKey: 'devkey', apiSecret: 'secret' });
    expect(RoomServiceClient).toHaveBeenCalledWith('ws://localhost:7880', 'devkey', 'secret');
    expect(deleteRoom).toHaveBeenCalledWith('room-1');
  });
});
