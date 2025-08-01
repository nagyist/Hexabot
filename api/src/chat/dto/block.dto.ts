/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { z } from 'zod';

import { Validate } from '@/utils/decorators/validate.decorator';
import { DtoConfig } from '@/utils/types/dto.types';
import { IsObjectId } from '@/utils/validation-rules/is-object-id';

import { CaptureVar, captureVarSchema } from '../schemas/types/capture-var';
import {
  BlockMessage,
  blockMessageObjectSchema,
} from '../schemas/types/message';
import { BlockOptions, BlockOptionsSchema } from '../schemas/types/options';
import { Pattern, patternSchema } from '../schemas/types/pattern';
import { Position, positionSchema } from '../schemas/types/position';

export class BlockCreateDto {
  @ApiProperty({ description: 'Block name', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Block patterns', type: Array })
  @IsOptional()
  @Validate(z.array(patternSchema))
  patterns?: Pattern[] = [];

  @ApiPropertyOptional({
    description: "Block's outcomes",
    type: Array,
  })
  @IsOptional()
  @IsArray({ message: 'Outcomes are invalid' })
  outcomes?: string[] = [];

  @ApiPropertyOptional({ description: 'Block trigger labels', type: Array })
  @IsOptional()
  @IsArray()
  @IsObjectId({ each: true, message: 'Trigger label must be a valid objectId' })
  trigger_labels?: string[] = [];

  @ApiPropertyOptional({ description: 'Block assign labels', type: Array })
  @IsOptional()
  @IsArray()
  @IsObjectId({ each: true, message: 'Assign label must be a valid objectId' })
  assign_labels?: string[] = [];

  @ApiPropertyOptional({ description: 'Block trigger channels', type: Array })
  @IsOptional()
  @IsArray()
  trigger_channels?: string[] = [];

  @ApiPropertyOptional({ description: 'Block options', type: Object })
  @IsOptional()
  @IsObject()
  @Validate(BlockOptionsSchema)
  options?: BlockOptions;

  @ApiProperty({ description: 'Block message', type: Object })
  @IsNotEmpty()
  @Validate(blockMessageObjectSchema)
  message: BlockMessage;

  @ApiPropertyOptional({ description: 'next blocks', type: Array })
  @IsOptional()
  @IsArray()
  @IsObjectId({ each: true, message: 'Next block must be a valid objectId' })
  nextBlocks?: string[];

  @ApiPropertyOptional({ description: 'attached blocks', type: String })
  @IsOptional()
  @IsString()
  @IsObjectId({
    message: 'Attached block must be a valid objectId',
  })
  attachedBlock?: string | null;

  @ApiProperty({ description: 'Block category', type: String })
  @IsNotEmpty()
  @IsString()
  @IsObjectId({ message: 'Category must be a valid objectId' })
  category: string | null;

  @ApiPropertyOptional({
    description: 'Block has started conversation',
    type: Boolean,
  })
  @IsBoolean()
  @IsOptional()
  starts_conversation?: boolean;

  @ApiPropertyOptional({
    description: 'Block capture vars',
    type: Array,
  })
  @IsOptional()
  @Validate(z.array(captureVarSchema))
  capture_vars?: CaptureVar[];

  @ApiProperty({
    description: 'Block position',
    type: Object,
  })
  @IsNotEmpty()
  @Validate(positionSchema)
  position: Position;
}

export class BlockUpdateDto extends PartialType(
  OmitType(BlockCreateDto, [
    'patterns',
    'outcomes',
    'trigger_labels',
    'assign_labels',
    'trigger_channels',
  ]),
) {
  @ApiPropertyOptional({ description: 'Block patterns', type: Array })
  @IsOptional()
  @Validate(z.array(patternSchema))
  patterns?: Pattern[];

  @ApiPropertyOptional({
    description: "Block's outcomes",
    type: Array,
  })
  @IsOptional()
  @IsArray({ message: 'Outcomes are invalid' })
  outcomes?: string[];

  @ApiPropertyOptional({ description: 'Block trigger labels', type: Array })
  @IsOptional()
  @IsArray()
  @IsObjectId({ each: true, message: 'Trigger label must be a valid objectId' })
  trigger_labels?: string[];

  @ApiPropertyOptional({ description: 'Block assign labels', type: Array })
  @IsOptional()
  @IsArray()
  @IsObjectId({ each: true, message: 'Assign label must be a valid objectId' })
  assign_labels?: string[];

  @ApiPropertyOptional({ description: 'Block trigger channels', type: Array })
  @IsArray()
  @IsOptional()
  trigger_channels?: string[];
}

export type BlockDto = DtoConfig<{
  create: BlockCreateDto;
}>;
