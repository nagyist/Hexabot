/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';

import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '@/utils/test/test';
import { buildTestingMocks } from '@/utils/test/utils';

import { SocketEventDispatcherService } from './services/socket-event-dispatcher.service';
import { Room } from './types';
import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let app: INestApplication;
  let createSocket: (id: string, query?: any) => Socket;
  let sockets: Socket[];

  beforeAll(async () => {
    const { module } = await buildTestingMocks({
      providers: [WebsocketGateway, SocketEventDispatcherService],
      imports: [
        rootMongooseTestModule(({ uri, dbName }) => {
          process.env.MONGO_URI = uri;
          process.env.MONGO_DB = dbName;
          return Promise.resolve();
        }),
      ],
    });
    app = module.createNestApplication();
    gateway = app.get<WebsocketGateway>(WebsocketGateway);

    createSocket = (id: string, query: any = {}) =>
      io('http://localhost:3000', {
        autoConnect: false,
        transports: ['websocket'],
        query: { EIO: '4', transport: 'websocket', ...query },
        extraHeaders: {
          'x-client-id': id,
        },
      });
    sockets = [
      createSocket('admin-1'), // Admin user 1
      createSocket('admin-2'), // Admin user 2
      createSocket('admin-3'), // Admin user 3
      createSocket('subscriber', { channel: 'web-channel' }), // Subscriber
    ];

    await app.listen(3000);
  });

  afterAll(async () => {
    await app.close();
    await closeInMongodConnection();
  });

  afterEach(jest.clearAllMocks);

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should connect successfully', async () => {
    const [socket1] = sockets;
    socket1.connect();

    await new Promise<void>((resolve) => {
      socket1.on('connect', async () => {
        expect(true).toBe(true);
        resolve();
      });
    });

    socket1.disconnect();
  });

  it('should emit "OK" on "healthcheck"', async () => {
    const [socket1] = sockets;

    socket1.connect();

    await new Promise<void>((resolve) => {
      socket1.on('connect', () => {
        socket1.emit('healthcheck', 'Hello world!');
        socket1.on('event', (data) => {
          expect(data).toBe('OK');
          resolve();
        });
      });
    });

    socket1.disconnect();
  });

  it('should join user to a giving room', async () => {
    const [admin1ClientSocket] = sockets;
    admin1ClientSocket.connect();

    await new Promise<void>((resolve) =>
      admin1ClientSocket.on('connect', () => {
        resolve();
      }),
    );

    const serverSockets = await gateway.io.fetchSockets();

    expect(serverSockets.length).toBe(1);

    const admin1ServerSocket = serverSockets.find(
      (s) => s.handshake.headers['x-client-id'] === 'admin-1',
    );

    await gateway.joinNotificationSockets(
      admin1ServerSocket?.data.sessionID,
      Room.MESSAGE,
    );

    const onMessagePromise = new Promise<void>((resolve) => {
      admin1ClientSocket.on('message', async ({ msg }) => {
        expect(msg).toBe('OK');
        resolve();
      });
    });

    gateway.io.to(Room.MESSAGE).emit('message', {
      op: 'messageSent',
      speakerId: 'speakerId',
      msg: 'OK',
    });

    await onMessagePromise;
    admin1ClientSocket.disconnect();
  });

  it('should allow users to join the global "Message" room', async () => {
    const [, admin2ClientSocket, admin3ClientSocket, subscriberSocket] =
      sockets;

    const onSubscriberConnect = new Promise<void>((resolve) =>
      subscriberSocket.on('connect', resolve),
    );
    subscriberSocket.connect();
    await onSubscriberConnect;

    const onSocket2Connect = new Promise<void>((resolve) =>
      admin2ClientSocket.on('connect', resolve),
    );
    admin2ClientSocket.connect();
    await onSocket2Connect;

    const onSocket3Connect = new Promise<void>((resolve) =>
      admin3ClientSocket.on('connect', resolve),
    );
    admin3ClientSocket.connect();
    await onSocket3Connect;

    const serverSockets = await gateway.io.fetchSockets();
    const admin2ServerSocket = serverSockets.find(
      (s) => s.handshake.headers['x-client-id'] === 'admin-2',
    );
    const admin3ServerSocket = serverSockets.find(
      (s) => s.handshake.headers['x-client-id'] === 'admin-3',
    );

    const subscriberServerSocket = serverSockets.find(
      (s) => s.handshake.headers['x-client-id'] === 'subscriber',
    );

    await gateway.joinNotificationSockets(
      admin2ServerSocket?.data.sessionID,
      Room.MESSAGE,
    );

    await gateway.joinNotificationSockets(
      admin3ServerSocket?.data.sessionID,
      Room.MESSAGE,
    );

    await expect(
      gateway.joinNotificationSockets(
        subscriberServerSocket?.data.sessionID,
        Room.MESSAGE,
      ),
    ).rejects.toThrow('No notification sockets found!');

    const onMessagePromise2 = new Promise<void>((resolve) => {
      admin2ClientSocket.on('message', async ({ data }) => {
        expect(data).toBe('The subscriber message');
        resolve();
      });
    });

    const onMessagePromise3 = new Promise<void>((resolve) => {
      admin3ClientSocket.on('message', async ({ data }) => {
        expect(data).toBe('The subscriber message');
        resolve();
      });
    });

    const onSubscriberMessagePromise = new Promise<void>((resolve, reject) => {
      subscriberSocket.on('message', async () => {
        reject();
      });
      setTimeout(() => resolve(), 100);
    });

    gateway.io
      .to(Room.MESSAGE)
      .emit('message', { data: 'The subscriber message' });

    await onMessagePromise2;
    await onMessagePromise3;
    await onSubscriberMessagePromise;

    admin2ClientSocket.disconnect();
    admin3ClientSocket.disconnect();
    subscriberSocket.disconnect();
  });

  it('should throw an error when socket array is empty', async () => {
    const originalGetNotificationSocket = gateway.getNotificationSockets;

    jest.spyOn(gateway, 'getNotificationSockets').mockResolvedValueOnce([]);

    await expect(
      gateway.joinNotificationSockets('sessionId', Room.MESSAGE),
    ).rejects.toThrow('No notification sockets found!');

    expect(gateway.getNotificationSockets).toHaveBeenCalledWith('sessionId');
    gateway.getNotificationSockets = originalGetNotificationSocket;
  });

  it('should throw an error with empty sessionId', async () => {
    await expect(
      gateway.joinNotificationSockets('', Room.MESSAGE),
    ).rejects.toThrow('SessionId is required!');
  });

  it('should throw an error with empty sessionId', async () => {
    await expect(gateway.getNotificationSockets('')).rejects.toThrow(
      'SessionId is required!',
    );
  });
});
