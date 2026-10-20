import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, Length, Matches } from 'class-validator';

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
