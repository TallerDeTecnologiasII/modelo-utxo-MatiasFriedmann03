import { Transaction, TransactionInput } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];
    const usedUTXOs = new Set<string>();
    let inputSum = 0;
    let outputSum = 0;

    if (transaction.inputs.length === 0) {
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_INPUTS, 'Transaction must have at least one input'));
    }

    for (const input of transaction.inputs) {
      const tx = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (!tx) {
        errors.push(createValidationError(VALIDATION_ERRORS.UTXO_NOT_FOUND, `Input UTXO ${input.utxoId} not found`));
        continue;
      }

      const txKey = `${input.utxoId.txId}:${input.owner}:${input.utxoId.outputIndex}`;
      if (usedUTXOs.has(txKey)) {
        errors.push(createValidationError(VALIDATION_ERRORS.DOUBLE_SPENDING, `Double spending detected for UTXO ${input.utxoId.txId}`)); 
        continue;
      }
      if (tx.amount <= 0) {
        errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT, `Negative or 0 amount in UTXO ${input.utxoId}`));
        continue;
      }
      usedUTXOs.add(txKey);
      inputSum += tx.amount;

      const txData = this.createTransactionDataForSigning_(transaction);
      if (!verify(txData, input.signature, input.owner)) {
        errors.push(createValidationError(VALIDATION_ERRORS.INVALID_SIGNATURE, `Invalid signature for input UTXO ${input.utxoId}`));
      }
    }

    if (transaction.outputs.length === 0) {
      errors.push(createValidationError(VALIDATION_ERRORS.EMPTY_OUTPUTS, 'Transaction must have at least one output'));
    }

    for (const output of transaction.outputs) {
      if (output.amount <= 0) {
        errors.push(createValidationError(VALIDATION_ERRORS.NEGATIVE_AMOUNT, 'Output amounts must be positive'));
        continue;
      }
      outputSum += output.amount;
    }
    
    if (inputSum !== outputSum) {
      errors.push(createValidationError(VALIDATION_ERRORS.AMOUNT_MISMATCH, `Input sum ${inputSum} does not match output sum ${outputSum}`)); 
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}
