import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'rider@example.com',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
