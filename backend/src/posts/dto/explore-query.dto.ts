import { IsIn, IsOptional } from 'class-validator';
import { CursorPaginationDto } from './cursor-pagination.dto.js';

export class ExploreQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  mediaOnly?: string;
}
