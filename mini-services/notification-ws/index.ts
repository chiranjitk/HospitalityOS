import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = parseInt(process.env.PORT || '3004', 10);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN || '',
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Track connected clients
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`[WS] Client connected: ${socket.id} (total: ${connectedClients})`);

  // Send welcome message with current stats
  socket.emit('connected', {
    message: 'StaySuite Real-time Service',
    timestamp: new Date().toISOString(),
    clientId: socket.id,
  });

  // Handle notification subscriptions
  socket.on('subscribe:property', (propertyId: string) => {
    socket.join(`property:${propertyId}`);
    console.log(`[WS] Client ${socket.id} subscribed to property:${propertyId}`);
  });

  socket.on('unsubscribe:property', (propertyId: string) => {
    socket.leave(`property:${propertyId}`);
  });

  // Handle notification events from the Next.js app
  socket.on('notification:send', (data: {
    type: string;
    propertyId?: string;
    tenantId?: string;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'error' | 'success';
  }) => {
    console.log(`[WS] Notification: [${data.type}] ${data.title}`);

    // Broadcast to property subscribers
    if (data.propertyId) {
      io.to(`property:${data.propertyId}`).emit('notification', data);
    }

    // Broadcast to all
    io.emit('notification', data);
  });

  // Handle WiFi session events
  socket.on('wifi:session-update', (data: {
    action: 'connect' | 'disconnect' | 'update';
    username: string;
    propertyId?: string;
    sessionId?: string;
  }) => {
    if (data.propertyId) {
      io.to(`property:${data.propertyId}`).emit('wifi:session', data);
    }
    io.emit('wifi:session', data);
  });

  // Handle booking events
  socket.on('booking:update', (data: {
    action: 'created' | 'checkin' | 'checkout' | 'cancelled' | 'modified';
    bookingId: string;
    propertyId?: string;
    guestName?: string;
    roomNumber?: string;
  }) => {
    if (data.propertyId) {
      io.to(`property:${data.propertyId}`).emit('booking', data);
    }
    io.emit('booking', data);
  });

  // Handle ping/heartbeat
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  socket.on('disconnect', (reason) => {
    connectedClients--;
    console.log(`[WS] Client disconnected: ${socket.id} (${reason}) (total: ${connectedClients})`);
  });
});

// Periodic health broadcast
setInterval(() => {
  io.emit('health', {
    connectedClients,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}, 30000);

httpServer.listen(PORT, () => {
  console.log(`[WS] StaySuite Notification WebSocket running on port ${PORT}`);
  console.log(`[WS] CORS allowed: http://localhost:3000`);
});
