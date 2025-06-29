/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { Model, PipelineStage, SortOrder, Types } from 'mongoose';

import { BaseRepository } from '@/utils/generics/base-repository';
import { PageQueryDto } from '@/utils/pagination/pagination-query.dto';
import { TFilterQuery } from '@/utils/types/filter.types';
import { Format } from '@/utils/types/format.types';

import { NlpValueDto } from '../dto/nlp-value.dto';
import {
  NLP_VALUE_POPULATE,
  NlpValue,
  NlpValueFull,
  NlpValueFullWithCount,
  NlpValuePopulate,
  NlpValueWithCount,
  TNlpValueCount,
} from '../schemas/nlp-value.schema';

@Injectable()
export class NlpValueRepository extends BaseRepository<
  NlpValue,
  NlpValuePopulate,
  NlpValueFull,
  NlpValueDto
> {
  constructor(@InjectModel(NlpValue.name) readonly model: Model<NlpValue>) {
    super(model, NlpValue, NLP_VALUE_POPULATE, NlpValueFull);
  }

  private getSortDirection(sortOrder: SortOrder) {
    return typeof sortOrder === 'number'
      ? sortOrder
      : sortOrder.toString().toLowerCase() === 'desc'
        ? -1
        : 1;
  }

  /**
   * Performs an aggregation to retrieve NLP values with their sample counts.
   *
   * @param format - The format can be full or stub
   * @param pageQuery - The pagination parameters
   * @param filterQuery - The filter criteria
   * @returns Aggregated Nlp Value results with sample counts
   */
  private async aggregateWithCount<F extends Format>(
    format: F,
    {
      limit = 10,
      skip = 0,
      sort = ['createdAt', 'desc'],
    }: PageQueryDto<NlpValue>,
    { $and = [], ...rest }: TFilterQuery<NlpValue>,
  ): Promise<TNlpValueCount<F>[]> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...rest,
          ...($and.length
            ? {
                $and: $and.map(({ entity, ...rest }) => ({
                  ...rest,
                  ...(entity
                    ? { entity: new Types.ObjectId(String(entity)) }
                    : {}),
                })),
              }
            : {}),
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'nlpsampleentities',
          localField: '_id',
          foreignField: 'value',
          as: '_sampleEntities',
        },
      },
      {
        $unwind: {
          path: '$_sampleEntities',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$_id',
          _originalDoc: {
            $first: {
              $unsetField: { input: '$$ROOT', field: 'nlpSamplesCount' },
            },
          },
          nlpSamplesCount: {
            $sum: { $cond: [{ $ifNull: ['$_sampleEntities', false] }, 1, 0] },
          },
        },
      },
      {
        $replaceWith: {
          $mergeObjects: [
            '$_originalDoc',
            { nlpSamplesCount: '$nlpSamplesCount' },
          ],
        },
      },
      ...(format === Format.FULL
        ? [
            {
              $lookup: {
                from: 'nlpentities',
                localField: 'entity',
                foreignField: '_id',
                as: 'entity',
              },
            },
            {
              $unwind: '$entity',
            },
          ]
        : []),
      {
        $sort: {
          [sort[0]]: this.getSortDirection(sort[1]),
          _id: this.getSortDirection(sort[1]),
        },
      },
    ];

    return await this.model.aggregate<TNlpValueCount<F>>(pipeline).exec();
  }

  async findWithCount<F extends Format>(
    format: F,
    pageQuery: PageQueryDto<NlpValue>,
    filterQuery: TFilterQuery<NlpValue>,
  ): Promise<TNlpValueCount<F>[]> {
    try {
      const aggregatedResults = await this.aggregateWithCount(
        format,
        pageQuery,
        filterQuery,
      );

      if (format === Format.FULL) {
        return plainToInstance(NlpValueFullWithCount, aggregatedResults, {
          excludePrefixes: ['_'],
        }) as TNlpValueCount<F>[];
      }

      return plainToInstance(NlpValueWithCount, aggregatedResults, {
        excludePrefixes: ['_'],
      }) as TNlpValueCount<F>[];
    } catch (error) {
      this.logger.error(`Error in findWithCount: ${error.message}`, error);
      throw error;
    }
  }
}
