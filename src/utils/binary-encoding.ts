import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
  const parts: Buffer[] = [];

  // ID
  parts.push(encodeString(transaction.id));

  // Inputs
  if (transaction.inputs.length > 255) throw new Error("Demasiados inputs (>255)");
  parts.push(Buffer.from([transaction.inputs.length]));
  for (const inp of transaction.inputs) {
    parts.push(encodeString(inp.utxoId.txId));

    const outIndexBuf = Buffer.alloc(4);
    outIndexBuf.writeUInt32LE(inp.utxoId.outputIndex, 0);
    parts.push(outIndexBuf);

    // owner
    parts.push(encodeString(inp.owner));

    // signature
    parts.push(encodeString(inp.signature));
  }

  // Outputs
  if (transaction.outputs.length > 255) throw new Error("Demasiados outputs (>255)");
  parts.push(Buffer.from([transaction.outputs.length]));
  for (const out of transaction.outputs) {
    parts.push(encodeString(out.recipient));

    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(out.amount), 0);
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
  let offset = 0;

  // ID
  const idRes = decodeString(buffer, offset);
  const id = idRes.value;
  offset = idRes.nextOffset;

  // Inputs
  const nInputs = buffer.readUInt8(offset++);
  const inputs: TransactionInput[] = [];
  for (let i = 0; i < nInputs; i++) {
    const txIdRes = decodeString(buffer, offset);
    const txId = txIdRes.value;
    offset = txIdRes.nextOffset;

    const outputIndex = buffer.readUInt32LE(offset);
    offset += 4;

    // owner
    const ownerRes = decodeString(buffer, offset);
    const owner = ownerRes.value;
    offset = ownerRes.nextOffset;
    
    // signature
    const sigRes = decodeString(buffer, offset);
    const signature = sigRes.value;
    offset = sigRes.nextOffset;
    
    inputs.push({
      utxoId: { txId, outputIndex },
      owner,
      signature
    } as any);
  }

  // Outputs
  const nOutputs = buffer.readUInt8(offset++);
  const outputs: TransactionOutput[] = [];
  for (let i = 0; i < nOutputs; i++) {
    const addrRes = decodeString(buffer, offset);
    const recipient = addrRes.value;
    offset = addrRes.nextOffset;

    const amount = buffer.readBigUInt64LE(offset);
    offset += 8;

    outputs.push({ recipient, amount: Number(amount) } as any);
  }

  // Timestamp (8 bytes)
  const timestamp = Number(buffer.readBigUInt64LE(offset));
  offset += 8;

  return { id, inputs, outputs, timestamp };
}

// Auxiliares 
function encodeString(str: string): Buffer {
  const safeStr = str ?? "";
  const buf = Buffer.from(safeStr, "utf8");
  if (buf.length > 255) throw new Error("String demasiado largo (>255 bytes)");
  return Buffer.concat([Buffer.from([buf.length]), buf]);
}

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
