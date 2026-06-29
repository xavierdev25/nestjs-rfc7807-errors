import { TransactionEntity } from '../../domain/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../domain/value-objects/transaction-status.enum';

/**
 * Response DTO for transaction data.
 * Maps the domain entity to a clean API response without leaking internals.
 */
export class TransactionResponseDto {
  id!: string;
  type!: TransactionType;
  status!: TransactionStatus;
  amount!: number;
  currency!: string;
  description!: string | null;
  metadata!: Record<string, unknown> | null;
  externalId!: string | null;
  failureReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  /**
   * Maps a domain entity to the response DTO.
   */
  static fromEntity(entity: TransactionEntity): TransactionResponseDto {
    const dto = new TransactionResponseDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.status = entity.status;
    dto.amount = entity.amountInCents;
    dto.currency = entity.currency;
    dto.description = entity.description;
    dto.metadata = entity.metadata;
    dto.externalId = entity.externalId;
    dto.failureReason = entity.failureReason;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

/**
 * Paginated response wrapper.
 */
export class PaginatedResponseDto<T> {
  data!: T[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}
