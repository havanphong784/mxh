import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ExploreQueryDto } from '../../posts/dto/explore-query.dto.js';

export class SearchQueryDto extends ExploreQueryDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}
