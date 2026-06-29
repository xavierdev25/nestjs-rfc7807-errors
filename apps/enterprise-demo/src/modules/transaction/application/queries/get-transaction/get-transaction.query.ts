/**
 * CQRS Query to retrieve a single transaction by ID.
 */
export class GetTransactionQuery {
  constructor(public readonly transactionId: string) {}
}
