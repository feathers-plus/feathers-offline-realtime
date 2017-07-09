
import md5 from 'md5';
import uuidV4 from 'uuid/v4';
import shortid from 'shortid';
import { stripProps } from './misc';

// Integrity of short unique identifiers: https://github.com/dylang/shortid/issues/81#issuecomment-259812835

export function genUuid(ifShortUuid) {
  return ifShortUuid ?  shortid.generate() : uuidV4();
}

export function hash(value) {
  value = typeof value === 'string' ? value : JSON.stringify(value);
  return md5(value);
}

export function hashOfRecord(record) {
  return hash(stripProps(record, ['id', '_id']));
}
