/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { IGNORED_TEST_FIELDS } from '@/utils/test/constants';
import { installPermissionFixtures } from '@/utils/test/fixtures/permission';
import { userFixtures } from '@/utils/test/fixtures/user';
import { getPageQuery } from '@/utils/test/pagination';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '@/utils/test/test';
import { buildTestingMocks } from '@/utils/test/utils';

import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';
import { Role } from '../schemas/role.schema';
import { User, UserFull } from '../schemas/user.schema';

describe('UserRepository', () => {
  let roleRepository: RoleRepository;
  let userRepository: UserRepository;
  let userModel: Model<User>;
  let user: User | null;
  let allRoles: Role[];

  const FIELDS_TO_IGNORE: string[] = [
    ...IGNORED_TEST_FIELDS,
    'password',
    'language',
    'resetCount',
    'sendEmail',
    'state',
    'timezone',
    'resetToken',
    'provider',
  ];

  beforeAll(async () => {
    const { getMocks } = await buildTestingMocks({
      models: ['PermissionModel', 'InvitationModel', 'AttachmentModel'],
      autoInjectFrom: ['providers'],
      imports: [rootMongooseTestModule(installPermissionFixtures)],
      providers: [UserRepository, RoleRepository],
    });
    [roleRepository, userRepository, userModel] = await getMocks([
      RoleRepository,
      UserRepository,
      getModelToken(User.name),
    ]);
    user = await userRepository.findOne({ username: 'admin' });
    allRoles = await roleRepository.findAll();
  });

  afterAll(closeInMongodConnection);

  afterEach(jest.clearAllMocks);

  describe('findOneAndPopulate', () => {
    it('should find one user and populate its role', async () => {
      jest.spyOn(userModel, 'findById');
      const result = await userRepository.findOneAndPopulate(user!.id);
      expect(userModel.findById).toHaveBeenCalledWith(user!.id, undefined);
      expect(result).toEqualPayload(
        {
          ...userFixtures.find(({ username }) => username === 'admin'),
          roles: allRoles.filter(({ id }) => user!.roles.includes(id)),
        },
        FIELDS_TO_IGNORE,
      );
    });
  });

  describe('findAndPopulate', () => {
    it('should find users, and for each user populate the corresponding roles', async () => {
      jest.spyOn(userModel, 'find');
      const pageQuery = getPageQuery<User>({ sort: ['_id', 'asc'] });
      const allUsers = await userRepository.findAll();
      const allRoles = await roleRepository.findAll();
      const result = await userRepository.findAndPopulate({}, pageQuery);
      const usersWithRoles = allUsers.reduce((acc, currUser) => {
        acc.push({
          ...currUser,
          roles: allRoles.filter(({ id }) => user?.roles.includes(id)),
          avatar: null,
        });
        return acc;
      }, [] as UserFull[]);

      expect(userModel.find).toHaveBeenCalledWith({}, undefined);
      expect(result).toEqualPayload(usersWithRoles);
    });
  });
});
