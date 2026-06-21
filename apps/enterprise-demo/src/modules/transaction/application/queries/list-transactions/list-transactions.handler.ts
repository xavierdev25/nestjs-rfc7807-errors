import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListTransactionsQuery } from './list-transactions.query';
import {
  TransactionRepositoryPort,
  TRANSACTION_REPOSITORY,
} from '../../../domain/ports/transaction.repository.port';
import {
  TransactionResponseDto,
  PaginatedResponseDto,
} from '../../dto/transaction-response.dto';

/**
 * Handler for ListTransactionsQuery.
 * Returns a paginated list of transactions with optional filters.
 */
@QueryHandler(ListTransactionsQuery)
export class ListTransactionsHandler implements IQueryHandler<
  ListTransactionsQuery,
  PaginatedResponseDto<TransactionResponseDto>
> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepositoryPort,
  ) {}

  async execute(
    query: ListTransactionsQuery,
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    const result = await this.transactionRepository.findAll({
      page: query.page,
      limit: query.limit,
      status: query.status,
      type: query.type,
    });

    const response = new PaginatedResponseDto<TransactionResponseDto>();
    response.data = result.data.map(TransactionResponseDto.fromEntity);
    response.total = result.total;
    response.page = result.page;
    response.limit = result.limit;
    response.totalPages = result.totalPages;

    return response;
  }
}
