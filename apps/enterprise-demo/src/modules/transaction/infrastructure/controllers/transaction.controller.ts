import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateTransactionDto } from '../../application/dto/create-transaction.dto';
import {
  TransactionResponseDto,
  PaginatedResponseDto,
} from '../../application/dto/transaction-response.dto';
import { CreateTransactionCommand } from '../../application/commands/create-transaction/create-transaction.command';
import { ProcessTransactionCommand } from '../../application/commands/process-transaction/process-transaction.command';
import { GetTransactionQuery } from '../../application/queries/get-transaction/get-transaction.query';
import { ListTransactionsQuery } from '../../application/queries/list-transactions/list-transactions.query';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../../shared/auth/interfaces/jwt-payload.interface';
import { Idempotent } from '../../../../shared/idempotency/idempotent.decorator';
import {
  TransactionStatus,
  TransactionType,
} from '../../domain/value-objects/transaction-status.enum';

/**
 * Transaction Controller (Infrastructure Layer — Adapter).
 *
 * Maps HTTP requests to CQRS commands/queries.
 * All endpoints require JWT authentication (global guard).
 */
@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /transactions
   * Creates a new transaction. Requires X-Idempotency-Key header.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent(86400) // 24h TTL
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionResponseDto> {
    const command = new CreateTransactionCommand(
      user.tenantId,
      user.userId,
      dto.type,
      dto.amount,
      dto.currency,
      dto.description,
      dto.metadata,
    );

    return this.commandBus.execute(command);
  }

  /**
   * GET /transactions/:id
   * Retrieves a single transaction by ID.
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.queryBus.execute(new GetTransactionQuery(id));
  }

  /**
   * GET /transactions
   * Lists transactions with optional filters and pagination.
   */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: TransactionStatus,
    @Query('type') type?: TransactionType,
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    const query = new ListTransactionsQuery(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      type,
    );

    return this.queryBus.execute(query);
  }

  /**
   * PATCH /transactions/:id/process
   * Processes a pending transaction. Requires X-Idempotency-Key header.
   * Restricted to privileged roles (RBAC).
   */
  @Patch(':id/process')
  @Roles('admin', 'operator')
  @Idempotent(86400)
  async process(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.commandBus.execute(new ProcessTransactionCommand(id));
  }
}
