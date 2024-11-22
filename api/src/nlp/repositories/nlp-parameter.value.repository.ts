/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import assert from 'assert';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model, Query } from 'mongoose';

import { BaseRepository, DeleteResult } from '@/utils/generics/base-repository';
import { TFilterQuery } from '@/utils/types/filter.types';

import {
  NLP_PARAMETER_VALUE_POPULATE,
  NlpParameterValue,
  NlpParameterValueFull,
  NlpParameterValuePopulate,
} from '../schemas/nlp-parameter-value.schema';

import { NlpExperimentRepository } from './nlp-experiment.repository';
import { NlpModelRepository } from './nlp-model.repository';

@Injectable()
export class NlpParameterValueRepository extends BaseRepository<
  NlpParameterValue,
  NlpParameterValuePopulate,
  NlpParameterValueFull
> {
  constructor(
    readonly eventEmitter: EventEmitter2,
    @InjectModel(NlpParameterValue.name)
    readonly model: Model<NlpParameterValue>,
    private readonly nlpExperimentRepository: NlpExperimentRepository,
    private readonly nlpModelRepository: NlpModelRepository,
  ) {
    super(
      eventEmitter,
      model,
      NlpParameterValue,
      NLP_PARAMETER_VALUE_POPULATE,
      NlpParameterValueFull,
    );
  }

  async preCreate(parameterValue: Partial<NlpParameterValue>): Promise<void> {
    const experiment = await this.nlpExperimentRepository.findOne({
      _id: parameterValue.experiment,
    });

    if (!experiment) {
      throw new Error(
        `Experiment with ID ${parameterValue.experiment} not found.`,
      );
    }
    // Check if the associated model exists
    const model = await this.nlpModelRepository.findOne({
      _id: parameterValue.model,
    });

    if (!model) {
      throw new Error(`Experiment with ID ${parameterValue.model} not found.`);
    }
    const updatedModel = await this.nlpModelRepository.updateOne(
      { _id: model.id },
      { $inc: { version: 1 } },
    );

    if (!updatedModel) {
      throw new Error(`Failed to update model version for ID ${model.id}.`);
    }

    // Set the metric value's model and version
    parameterValue.model = updatedModel.id;
    parameterValue.version = updatedModel.version;
    assert(
      parameterValue.version === experiment.current_version,
      `Parameter Value version (${parameterValue.version}) does not match the experiment's current version (${experiment.current_version}).`,
    );
  }

  /**
   * Deletes NLP experiment associated with the provided criteria before deleting the Parameters themselves.
   *
   * @param query - The query object used for deletion.
   * @param criteria - Criteria to identify the sample(s) to delete.
   */
  async preDelete(
    _query: Query<
      DeleteResult,
      Document<NlpParameterValue, any, any>,
      unknown,
      NlpParameterValue,
      'deleteOne' | 'deleteMany'
    >,
    criteria: TFilterQuery<NlpParameterValue>,
  ): Promise<void> {
    {
      if (criteria) {
        const relatedExperimentIds = await this.nlpExperimentRepository
          .find({
            metrics: {
              $elemMatch: { metric: criteria.parameter, value: criteria.value },
            },
          })
          .then((results) => results.map((doc) => doc.id));

        if (relatedExperimentIds.length > 0) {
          for (const experimentId of relatedExperimentIds) {
            const updatedModel = await this.nlpModelRepository.updateOne(
              { experiments: experimentId }, // Valid for single ObjectId
              {
                $pull: { experiments: experimentId },
                $inc: { version: -1 },
              },
            );

            if (
              updatedModel &&
              updatedModel.version <= 0 &&
              updatedModel.experiments.length === 0
            ) {
              // Delete the model if conditions are met
              await this.nlpModelRepository.deleteOne({
                _id: updatedModel.id,
              });
            }
          }
        }
      } else {
        throw new Error(
          'Attempted to delete NLP experiment using unknown criteria',
        );
      }
    }
  }
}
