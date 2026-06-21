/**
 * CQRS Command to process an existing transaction.
 */
export class ProcessTransactionCommand {
  constructor(public readonly transactionId: string) {}
}
