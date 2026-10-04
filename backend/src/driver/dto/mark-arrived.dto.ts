import { IsInt, Min } from 'class-validator';

export class MarkArrivedDto {
  @IsInt()
  @Min(0)
  version!: number;
}