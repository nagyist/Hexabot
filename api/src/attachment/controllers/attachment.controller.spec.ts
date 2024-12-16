/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common/exceptions';
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Session as ExpressSession } from 'express-session';

import { LoggerService } from '@/logger/logger.service';
import { PluginService } from '@/plugins/plugins.service';
import { PermissionRepository } from '@/user/repositories/permission.repository';
import { RoleRepository } from '@/user/repositories/role.repository';
import { UserRepository } from '@/user/repositories/user.repository';
import { PermissionModel } from '@/user/schemas/permission.schema';
import { RoleModel } from '@/user/schemas/role.schema';
import { UserModel } from '@/user/schemas/user.schema';
import { PermissionService } from '@/user/services/permission.service';
import { RoleService } from '@/user/services/role.service';
import { UserService } from '@/user/services/user.service';
import { NOT_FOUND_ID } from '@/utils/constants/mock';
import { IGNORED_TEST_FIELDS } from '@/utils/test/constants';
import {
  attachmentFixtures,
  installAttachmentFixtures,
} from '@/utils/test/fixtures/attachment';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '@/utils/test/test';

import { attachment, attachmentFile } from '../mocks/attachment.mock';
import { AttachmentRepository } from '../repositories/attachment.repository';
import { Attachment, AttachmentModel } from '../schemas/attachment.schema';
import { AttachmentService } from '../services/attachment.service';

import { AttachmentController } from './attachment.controller';

describe('AttachmentController', () => {
  let attachmentController: AttachmentController;
  let attachmentService: AttachmentService;
  let attachmentToDelete: Attachment;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentController],
      imports: [
        rootMongooseTestModule(installAttachmentFixtures),
        MongooseModule.forFeature([
          AttachmentModel,
          UserModel,
          RoleModel,
          PermissionModel,
        ]),
      ],
      providers: [
        AttachmentService,
        AttachmentRepository,
        RoleRepository,
        RoleService,
        UserRepository,
        UserService,
        PermissionRepository,
        PermissionService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            del: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        LoggerService,
        EventEmitter2,
        PluginService,
      ],
    }).compile();
    attachmentController =
      module.get<AttachmentController>(AttachmentController);
    attachmentService = module.get<AttachmentService>(AttachmentService);
    attachmentToDelete = await attachmentService.findOne({
      name: 'store1.jpg',
    });
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  afterEach(jest.clearAllMocks);

  describe('count', () => {
    it('should count attachments', async () => {
      jest.spyOn(attachmentService, 'count');
      const result = await attachmentController.filterCount();

      expect(attachmentService.count).toHaveBeenCalled();
      expect(result).toEqual({ count: attachmentFixtures.length });
    });
  });

  describe('Upload', () => {
    it('should throw BadRequestException if no file is selected to be uploaded', async () => {
      const promiseResult = attachmentController.uploadFile(
        {
          file: undefined,
        },
        { context: 'user_avatar' },
      );
      await expect(promiseResult).rejects.toThrow(
        new BadRequestException('No file was selected'),
      );
    });

    it('should upload attachment', async () => {
      jest.spyOn(attachmentService, 'create');
      const result = await attachmentController.uploadFile(
        {
          file: [attachmentFile],
        },
        { context: 'user_avatar' },
      );
      expect(attachmentService.create).toHaveBeenCalledWith({
        size: attachmentFile.size,
        type: attachmentFile.mimetype,
        name: attachmentFile.filename,
        channel: {},
        location: `/${attachmentFile.filename}`,
        context: 'user_avatar',
      });

      expect(result).toEqualPayload(
        [attachment],
        [...IGNORED_TEST_FIELDS, 'url', 'owner'],
      );
    });
  });

  describe('Download', () => {
    it(`should throw NotFoundException the id or/and file don't exist`, async () => {
      jest.spyOn(attachmentService, 'findOne');
      const result = attachmentController.download({ id: NOT_FOUND_ID });
      expect(attachmentService.findOne).toHaveBeenCalledWith(NOT_FOUND_ID);
      expect(result).rejects.toThrow(
        new NotFoundException('Attachment not found'),
      );
    });

    it(`should throw BadRequestException if the user is not the Attachment owner`, async () => {
      jest.spyOn(attachmentService, 'findOne');
      const storedAttachment = await attachmentService.findOne({
        name: 'store1.jpg',
      });
      const result = attachmentController.download(
        {
          id: storedAttachment.id,
        },
        {
          passport: {
            user: {
              id: NOT_FOUND_ID,
            },
          },
        } as ExpressSession,
      );

      expect(attachmentService.findOne).toHaveBeenCalledWith(
        storedAttachment.id,
      );
      expect(result).rejects.toThrow(
        new BadRequestException('You cannot access this Attachment'),
      );
    });

    it('should download the attachment by id', async () => {
      jest.spyOn(attachmentService, 'findOne');
      const storedAttachment = await attachmentService.findOne({
        name: 'store1.jpg',
      });
      const result = await attachmentController.download(
        {
          id: storedAttachment.id,
        },
        {
          passport: {
            user: {
              id: attachmentFixtures[0].owner,
            },
          },
        } as ExpressSession,
      );

      expect(attachmentService.findOne).toHaveBeenCalledWith(
        storedAttachment.id,
      );
      expect(result.options).toEqual({
        type: storedAttachment.type,
        length: storedAttachment.size,
        disposition: `attachment; filename="${encodeURIComponent(
          storedAttachment.name,
        )}"`,
      });
    });
  });

  describe('deleteOne', () => {
    it('should delete an attachment by id', async () => {
      jest.spyOn(attachmentService, 'deleteOne');
      const result = await attachmentController.deleteOne(
        attachmentToDelete.id,
      );

      expect(attachmentService.deleteOne).toHaveBeenCalledWith(
        attachmentToDelete.id,
      );
      expect(result).toEqual({
        acknowledged: true,
        deletedCount: 1,
      });
    });

    it('should throw a NotFoundException when attempting to delete an attachment by id', async () => {
      await expect(
        attachmentController.deleteOne(attachmentToDelete.id),
      ).rejects.toThrow(
        new NotFoundException(
          `Attachment with ID ${attachmentToDelete.id} not found`,
        ),
      );
    });
  });
});
