/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CsrfCheck } from '@tekuconcept/nestjs-csrf';

import { CsrfInterceptor } from '@/interceptors/csrf.interceptor';
import { LoggerService } from '@/logger/logger.service';
import { PageQueryDto } from '@/utils/pagination/pagination-query.dto';
import { PageQueryPipe } from '@/utils/pagination/pagination-query.pipe';
import { SearchFilterPipe } from '@/utils/pipes/search-filter.pipe';
import { TFilterQuery } from '@/utils/types/filter.types';

import { Setting } from '../schemas/setting.schema';
import { SettingService } from '../services/setting.service';

@UseInterceptors(CsrfInterceptor)
@Controller('setting')
export class SettingController {
  constructor(
    private readonly settingService: SettingService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Finds settings that match the provided filters and sorting options.
   *
   * @param filters - Filters to apply when querying settings, limited to the `group` field.
   * @param sort - Sorting options for the query.
   *
   * @returns A list of settings that match the criteria.
   */
  @Get()
  async find(
    @Query(
      new SearchFilterPipe<Setting>({
        allowedFields: ['group'],
      }),
    )
    filters: TFilterQuery<Setting>,
    @Query(PageQueryPipe) pageQuery: PageQueryDto<Setting>,
  ) {
    return await this.settingService.find(filters, pageQuery);
  }

  /**
   * Updates a setting by its ID. If the setting does not exist, throws a `NotFoundException`.
   *
   * @param id - The ID of the setting to update.
   * @param settingUpdateDto - The new value of the setting.
   *
   * @returns The updated setting.
   */
  @CsrfCheck(true)
  @Patch(':id')
  async updateOne(
    @Param('id') id: string,
    @Body() settingUpdateDto: { value: any },
  ): Promise<Setting> {
    const setting = await this.settingService.findOne(id);

    if (!setting) {
      this.logger.warn(`Setting with ID ${id} not found`);
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    // Edge case handling:
    // If the setting type is 'number' but the value provided in the DTO is not already a number,
    // we attempt to convert the value to a number. This is necessary because the value might be
    // passed as a string representation of a number (e.g., "123"), and we need to ensure it's a number.
    const updatedValue =
      setting.type === 'number' && typeof settingUpdateDto.value !== 'number'
        ? Number(settingUpdateDto.value)
        : settingUpdateDto.value;

    const result = await this.settingService.updateOne(id, {
      value: updatedValue,
    });

    if (!result) {
      this.logger.warn(`Failed to update setting with ID ${id}`);
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    return result;
  }
}
