import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
  // BONUS CHALLENGE: Implement binary encoding for transactions
  // This should create a compact binary representation instead of JSON

  // Suggested approach:
  // 1. Use fixed-size fields where possible (e.g., 8 bytes for amounts, timestamps)
  // 2. Use length-prefixed strings for variable-length data (id, signatures, public keys)
  // 3. Use compact representations for counts (e.g., 1 byte for number of inputs/outputs if < 256)

  const parts: Buffer[] = [];

  // ID
  parts.push(encodeString(transaction.id));

  // Inputs
  if (transaction.inputs.length > 255) throw new Error("Demasiados inputs (>255)");
  parts.push(Buffer.from([transaction.inputs.length]));
  for (const inp of transaction.inputs) {
    parts.push(encodeString(String(inp.utxoId)));

    const outIndexBuf = Buffer.alloc(4);
    outIndexBuf.writeUInt32LE((inp as any).outputIndex, 0); 
    parts.push(outIndexBuf);

    parts.push(encodeString((inp as any).signature));
  }

  // Outputs
  if (transaction.outputs.length > 255) throw new Error("Demasiados outputs (>255)");
  parts.push(Buffer.from([transaction.outputs.length]));
  for (const out of transaction.outputs) {
    parts.push(encodeString((out as any).address));

    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt((out as any).amount), 0);
    parts.push(amountBuf);
  }

  // Timestamp (8 bytes)
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64LE(BigInt(transaction.timestamp), 0);
  parts.push(tsBuf);

  return Buffer.concat(parts);
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {
  // BONUS CHALLENGE: Implement binary decoding for transactions
  // This should reconstruct a Transaction object from the binary representation

  let offset = 0;

  // ID
  const idRes = decodeString(buffer, offset);
  const id = idRes.value;
  offset = idRes.nextOffset;

  // Inputs
  const nInputs = buffer.readUInt8(offset++);
  const inputs: TransactionInput[] = [];
  for (let i = 0; i < nInputs; i++) {
    const utxoIdRes = decodeString(buffer, offset);
    const utxoId = utxoIdRes.value;
    offset = utxoIdRes.nextOffset;

    const outputIndex = buffer.readUInt32LE(offset);
    offset += 4;

    const sigRes = decodeString(buffer, offset);
    const signature = sigRes.value;
    offset = sigRes.nextOffset;

    inputs.push({ utxoId, owner: "", signature, outputIndex } as any);
  }

  // Outputs
  const nOutputs = buffer.readUInt8(offset++);
  const outputs: TransactionOutput[] = [];
  for (let i = 0; i < nOutputs; i++) {
    const addrRes = decodeString(buffer, offset);
    const address = addrRes.value;
    offset = addrRes.nextOffset;

    const amount = buffer.readBigUInt64LE(offset);
    offset += 8;

    outputs.push({ address, amount: Number(amount) } as any);
  }

  // Timestamp
  const timestamp = Number(buffer.readBigUInt64LE(offset));
  offset += 8;

  return { id, inputs, outputs, timestamp };
}

// Auxiliares 
// String → Buffer con prefijo de longitud (1 byte)
function encodeString(str: string): Buffer {
  const buf = Buffer.from(str, "utf8");
  if (buf.length > 255) throw new Error("String demasiado largo (>255 bytes)");
  return Buffer.concat([Buffer.from([buf.length]), buf]);
}

// Buffer → String con prefijo de longitud (1 byte)
function decodeString(buffer: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buffer.readUInt8(offset);
  const start = offset + 1;
  const end = start + len;
  return {
    value: buffer.toString("utf8", start, end),
    nextOffset: end,
  };
}

/**
 * Compare encoding efficiency between JSON and binary representations
 * @param {Transaction} transaction - The transaction to analyze
 * @returns {object} Size comparison and savings information
 */
export function getEncodingEfficiency(transaction: Transaction): {
  jsonSize: number;
  binarySize: number;
  savings: string;
} {
  const jsonSize = Buffer.from(JSON.stringify(transaction)).length;
  try {
    const binarySize = encodeTransaction(transaction).length;
    const savingsPercent = (((jsonSize - binarySize) / jsonSize) * 100).toFixed(1);
    return {
      jsonSize,
      binarySize,
      savings: `${savingsPercent}%`
    };
  } catch {
    return {
      jsonSize,
      binarySize: -1,
      savings: 'Not implemented'
    };
  }
}
