/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseRepository } from '@/utils/generics/base-repository';

import { NlpEntityDto } from '../dto/nlp-entity.dto';
import {
  NLP_ENTITY_POPULATE,
  NlpEntity,
  NlpEntityFull,
  NlpEntityPopulate,
} from '../schemas/nlp-entity.schema';

@Injectable()
export class NlpEntityRepository extends BaseRepository<
  NlpEntity,
  NlpEntityPopulate,
  NlpEntityFull,
  NlpEntityDto
> {
  constructor(@InjectModel(NlpEntity.name) readonly model: Model<NlpEntity>) {
    super(model, NlpEntity, NLP_ENTITY_POPULATE, NlpEntityFull);
  }
}
