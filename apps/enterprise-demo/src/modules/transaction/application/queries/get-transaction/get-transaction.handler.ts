import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionQuery } from './get-transaction.query';
import {
  TransactionRepositoryPort,
  TRANSACTION_REPOSITORY,
} from '../../../domain/ports/transaction.repository.port';
import { TransactionNotFoundError } from '../../../domain/errors/transaction-not-found.error';
import { TransactionResponseDto } from '../../dto/transaction-response.dto';

/**
 * Handler for GetTransactionQuery.
 * Loads a transaction by ID and maps it to a response DTO.
 */
@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<
  GetTransactionQuery,
  TransactionResponseDto
> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepositoryPort,
  ) {}

  async execute(query: GetTransactionQuery): Promise<TransactionResponseDto> {
    const transaction = await this.transactionRepository.findById(
      query.transactionId,
    );

    if (!transaction) {
      throw new TransactionNotFoundError(query.transactionId);
    }

    return TransactionResponseDto.fromEntity(transaction);
  }
}
