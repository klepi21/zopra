import { io as Client, Socket as ClientSocket } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const CLIENT_COUNT = 5;

async function runBenchmark() {
  console.log(`\n🚀 Starting Quizdin Server Load Test Benchmark`);
  console.log(`Connecting to server: ${SERVER_URL}`);
  console.log(`Simulating ${CLIENT_COUNT} concurrent players...\n`);

  const clients: ClientSocket[] = [];
  const startTimes: Record<string, number> = {};
  const latencies: number[] = [];

  // 1. Establish Connections
  const connectPromise = Array.from({ length: CLIENT_COUNT }).map((_, idx) => {
    return new Promise<ClientSocket>((resolve, reject) => {
      const userId = `benchmark_user_${idx}`;
      const token = `mock_${userId}`; // triggers test authorization bypass
      const startTime = Date.now();

      const socket = Client(SERVER_URL, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });

      socket.on('connect', () => {
        const elapsed = Date.now() - startTime;
        latencies.push(elapsed);
        clients.push(socket);
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        reject(new Error(`Failed to connect user ${idx}: ${err.message}`));
      });
    });
  });

  try {
    await Promise.all(connectPromise);
    const avgConnectTime = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`✓ All ${CLIENT_COUNT} clients connected successfully.`);
    console.log(`  Average Connection Latency: ${avgConnectTime.toFixed(1)} ms`);

    const host = clients[0];
    const guests = clients.slice(1);

    // 2. Create Room
    const roomCode = await new Promise<string>((resolve, reject) => {
      const startTime = Date.now();
      host.emit('create_room', (res: any) => {
        if (res.error) {
          reject(new Error(`Host failed to create room: ${res.error}`));
        } else {
          const latency = Date.now() - startTime;
          console.log(`✓ Room ${res.roomState.roomCode} created successfully (Latency: ${latency} ms).`);
          resolve(res.roomState.roomCode);
        }
      });
    });

    // 3. Guests Join Room
    const joinPromises = guests.map((guest, idx) => {
      return new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        guest.emit('join_room', { roomCode }, (res: any) => {
          if (res.error) {
            reject(new Error(`Guest ${idx} failed to join: ${res.error}`));
          } else {
            resolve();
          }
        });
      });
    });
    await Promise.all(joinPromises);
    console.log(`✓ All guest players joined room ${roomCode} successfully.`);

    // 4. Ready State Toggle
    const readyPromises = clients.map((client) => {
      return new Promise<void>((resolve, reject) => {
        client.emit('toggle_ready', (res: any) => {
          if (res.error) {
            reject(new Error(`Failed to toggle ready: ${res.error}`));
          } else {
            resolve();
          }
        });
      });
    });
    await Promise.all(readyPromises);
    console.log(`✓ All players toggled ready status.`);

    // 5. Clean disconnect
    clients.forEach((client) => {
      if (client.connected) {
        client.disconnect();
      }
    });

    console.log(`\n🎉 Load Test Benchmark completed successfully without any errors!`);
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Benchmark failed with error:`, error.message);
    clients.forEach((client) => {
      if (client.connected) {
        client.disconnect();
      }
    });
    process.exit(1);
  }
}

runBenchmark();
