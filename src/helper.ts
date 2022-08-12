import { Address, BigInt } from "@graphprotocol/graph-ts";
import { GAL, User, Transaction } from "../generated/schema";
import { Transfer as TransferEvent } from "../generated/GAL/GAL";

const GAL_NAME = "GAL";
const TRANSFER = "TRANSFER";
const MINT = "MINT";
const BURN = "BURN";
const BI_ZERO = BigInt.fromI32(0);
const BI_ONE = BigInt.fromI32(0);
const ADDRESS_ZERO = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

export enum UserType {
  SENDER,
  RECIEVER,
}

export function getOrCreateGAL(): GAL {
  let gal = GAL.load(GAL_NAME);

  if (gal === null) {
    gal = new GAL(GAL_NAME);
    gal.userCount = BI_ZERO;
    gal.transactionCount = BI_ZERO;
    gal.totalSupply = BI_ZERO;
    gal.save();
    return gal;
  }

  return gal as GAL;
}

export function createUser(id: string, event: TransferEvent): User {
  const user = new User(id);
  user.createdAtBlock = event.block.number;
  user.createdAtTimestamp = event.block.timestamp;
  user.modifiedAtBlock = event.block.number;
  user.modifiedAtTimestamp = event.block.timestamp;
  user.balance = BI_ZERO;
  user.save();

  const gal = getOrCreateGAL();
  gal.userCount = gal.userCount.plus(BI_ONE);
  gal.save();
  return user;
}

export function getOrCreateUser(type: UserType, event: TransferEvent): User {
  const id =
    type === UserType.SENDER
      ? event.params.from.toHex()
      : event.params.to.toHex();
  const user = User.load(id);

  if (user === null) {
    return createUser(id, event);
  }

  return user as User;
}

export function getOrCreateTransaction(event: TransferEvent): Transaction {
  const transaction = Transaction.load(event.transaction.hash.toHex());

  if (transaction === null) {
    return createTransaction(event);
  }

  return transaction as Transaction;
}

function createTransaction(event: TransferEvent): Transaction {
  const id = event.transaction.hash.toHex();
  const transaction = new Transaction(id);
  transaction.from = event.params.from.toHex();
  transaction.to = event.params.to.toHex();
  transaction.amount = event.params.value;
  transaction.gasUsed = event.block.gasUsed;
  transaction.gasLimit = event.transaction.gasLimit;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.block = event.block.number;
  transaction.timestamp = event.block.timestamp;

  const gal = getOrCreateGAL();
  gal.transactionCount = gal.transactionCount.plus(BI_ONE);

  if (isBurning(event)) {
    transaction.type = BURN;
    gal.totalSupply = gal.totalSupply.minus(event.params.value);
  } else if (isMinting(event)) {
    transaction.type = MINT;
    gal.totalSupply = gal.totalSupply.plus(event.params.value);
  } else {
    transaction.type = TRANSFER;
  }

  gal.save();
  transaction.save();

  return transaction as Transaction;
}

function isMinting(event: TransferEvent): boolean {
  return event.params.from == ADDRESS_ZERO;
}

function isBurning(event: TransferEvent): boolean {
  return event.params.to == ADDRESS_ZERO;
}
