import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const AUDIO_CONTENT_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
];

export function normalizeAudioContentType(value: unknown): string {
  return typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : '';
}

export class CreateUploadUrlDto {
  @IsString()
  @Length(1, 180)
  filename!: string;

  @IsString()
  @Transform(({ value }) => normalizeAudioContentType(value))
  @IsIn(AUDIO_CONTENT_TYPES)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  size!: number;
}

class MultipartPartDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  partNumber!: number;

  @IsString()
  @Length(1, 512)
  etag!: string;
}

export class CompleteMultipartUploadDto {
  @IsString()
  @Length(1, 1024)
  uploadId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultipartPartDto)
  parts!: MultipartPartDto[];
}

export class CreateAnalysisDto {
  @IsUUID()
  analysisId!: string;

  @IsString()
  @Matches(/^analyses\/[0-9a-f-]+\/.+$/i)
  objectKey!: string;

  @IsString()
  @Length(1, 180)
  originalFilename!: string;

  @IsString()
  @Transform(({ value }) => normalizeAudioContentType(value))
  @IsIn(AUDIO_CONTENT_TYPES)
  contentType!: string;
}
