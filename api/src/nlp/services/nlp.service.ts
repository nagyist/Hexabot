/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { HelperService } from '@/helper/helper.service';
import { HelperType, NLU } from '@/helper/types';
import { LoggerService } from '@/logger/logger.service';

import { NlpEntity, NlpEntityDocument } from '../schemas/nlp-entity.schema';
import { NlpValue, NlpValueDocument } from '../schemas/nlp-value.schema';

import { NlpEntityService } from './nlp-entity.service';
import { NlpSampleService } from './nlp-sample.service';
import { NlpValueService } from './nlp-value.service';

@Injectable()
export class NlpService {
  constructor(
    private readonly logger: LoggerService,
    protected readonly nlpSampleService: NlpSampleService,
    protected readonly nlpEntityService: NlpEntityService,
    protected readonly nlpValueService: NlpValueService,
    protected readonly helperService: HelperService,
  ) {}

  /**
   * Computes a prediction score for each parsed NLU entity based on its confidence and a predefined weight.
   *
   * `score = confidence * weight`
   *
   * If a weight is not defined for a given entity, a default of 1 is used.
   *
   * @param input - The input object containing parsed entities.
   * @param input.entities - The list of entities returned from NLU inference.
   *
   * @returns A promise that resolves to a list of scored entities.
   */
  async computePredictionScore({
    entities,
  }: NLU.ParseEntities): Promise<NLU.ScoredEntities> {
    const nlpMap = await this.nlpEntityService.getNlpMap();

    const scoredEntities = entities
      .filter(({ entity }) => nlpMap.has(entity))
      .map((e) => {
        const entity = nlpMap.get(e.entity)!;

        return {
          ...e,
          score: e.confidence * (entity.weight || 1),
        };
      });

    return { entities: scoredEntities };
  }

  /**
   * Handles the event triggered when a new NLP entity is created. Synchronizes the entity with the external NLP provider.
   *
   * @param entity - The NLP entity to be created.
   */
  @OnEvent('hook:nlpEntity:create')
  async handleEntityCreate(entity: NlpEntityDocument) {
    // Synchonize new entity with NLP
    try {
      const helper = await this.helperService.getDefaultHelper(HelperType.NLU);
      const foreignId = await helper.addEntity(entity);
      this.logger.debug('New entity successfully synced!', foreignId);
      await this.nlpEntityService.updateOne(
        { _id: entity._id },
        {
          foreign_id: foreignId,
        },
      );
    } catch (err) {
      this.logger.error('Unable to sync a new entity', err);
    }
  }

  /**
   * Handles the event triggered when an NLP entity is updated. Synchronizes the updated entity with the external NLP provider.
   *
   * @param entity - The NLP entity to be updated.
   */
  @OnEvent('hook:nlpEntity:update')
  async handleEntityUpdate(entity: NlpEntity) {
    // Synchonize new entity with NLP provider
    try {
      const helper = await this.helperService.getDefaultNluHelper();
      await helper.updateEntity(entity);
      this.logger.debug('Updated entity successfully synced!', entity);
    } catch (err) {
      this.logger.error('Unable to sync updated entity', err);
    }
  }

  /**
   * Handles the event triggered when an NLP entity is deleted. Synchronizes the deletion with the external NLP provider.
   *
   * @param entity - The NLP entity to be deleted.
   */
  @OnEvent('hook:nlpEntity:delete')
  async handleEntityDelete(entity: NlpEntity) {
    // Synchonize new entity with NLP provider
    try {
      if (entity.foreign_id) {
        const helper = await this.helperService.getDefaultNluHelper();
        await helper.deleteEntity(entity.foreign_id);
        this.logger.debug('Deleted entity successfully synced!', entity);
      } else {
        this.logger.error(`Entity ${entity} is missing foreign_id`);
        throw new NotFoundException(`Entity ${entity} is missing foreign_id`);
      }
    } catch (err) {
      this.logger.error('Unable to sync deleted entity', err);
    }
  }

  /**
   * Handles the event triggered when a new NLP value is created. Synchronizes the value with the external NLP provider.
   *
   * @param value - The NLP value to be created.
   */
  @OnEvent('hook:nlpValue:create')
  async handleValueCreate(value: NlpValueDocument) {
    // Synchonize new value with NLP provider
    try {
      const helper = await this.helperService.getDefaultNluHelper();
      const foreignId = await helper.addValue(value);
      this.logger.debug('New value successfully synced!', foreignId);
      await this.nlpValueService.updateOne(
        { _id: value._id },
        {
          foreign_id: foreignId,
        },
      );
    } catch (err) {
      this.logger.error('Unable to sync a new value', err);
    }
  }

  /**
   * Handles the event triggered when an NLP value is updated. Synchronizes the updated value with the external NLP provider.
   *
   * @param value - The NLP value to be updated.
   */
  @OnEvent('hook:nlpValue:update')
  async handleValueUpdate(value: NlpValue) {
    // Synchonize new value with NLP provider
    try {
      const helper = await this.helperService.getDefaultNluHelper();
      await helper.updateValue(value);
      this.logger.debug('Updated value successfully synced!', value);
    } catch (err) {
      this.logger.error('Unable to sync updated value', err);
    }
  }

  /**
   * Handles the event triggered when an NLP value is deleted. Synchronizes the deletion with the external NLP provider.
   *
   * @param value - The NLP value to be deleted.
   */
  @OnEvent('hook:nlpValue:delete')
  async handleValueDelete(value: NlpValue) {
    // Synchonize new value with NLP provider
    try {
      const helper = await this.helperService.getDefaultNluHelper();
      const populatedValue = await this.nlpValueService.findOneAndPopulate(
        value.id,
      );
      if (populatedValue) {
        await helper.deleteValue(populatedValue);
        this.logger.debug('Deleted value successfully synced!', value);
      }
    } catch (err) {
      this.logger.error('Unable to sync deleted value', err);
    }
  }
}
