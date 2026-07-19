import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ResendCodeDto {
  @IsEmail()
  email!: string;
}

export class Verify2faDto {
  @IsString()
  sessionToken!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class Enable2faDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
