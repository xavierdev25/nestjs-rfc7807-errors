import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { TransactionType } from '../../domain/value-objects/transaction-status.enum';

/**
 * DTO for creating a new transaction.
 * Validated by class-validator; validation errors produce BadRequestProblem.
 */
export class CreateTransactionDto {
  @IsEnum(TransactionType, {
    message: `type must be one of: ${Object.values(TransactionType).join(', ')}`,
  })
  @IsNotEmpty()
  type!: TransactionType;

  @IsInt({ message: 'amount must be an integer representing cents' })
  @IsPositive({ message: 'amount must be a positive integer' })
  amount!: number;

  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
