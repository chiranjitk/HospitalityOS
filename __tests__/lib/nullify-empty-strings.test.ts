import { describe, it, expect } from 'vitest';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';

describe('nullifyEmptyStrings', () => {
  it('should convert empty strings to null', () => {
    const input = { name: '', age: '25' };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: null, age: '25' });
  });

  it('should leave non-empty strings unchanged', () => {
    const input = { name: 'John', email: 'john@example.com' };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: 'John', email: 'john@example.com' });
  });

  it('should leave non-string values unchanged', () => {
    const input = {
      name: 'John',
      age: 30,
      active: true,
      score: null,
      tags: ['a', 'b'],
    };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({
      name: 'John',
      age: 30,
      active: true,
      score: null,
      tags: ['a', 'b'],
    });
  });

  it('should handle an empty object', () => {
    const result = nullifyEmptyStrings({});
    expect(result).toEqual({});
  });

  it('should handle all empty strings', () => {
    const input = { a: '', b: '', c: '' };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ a: null, b: null, c: null });
  });

  it('should handle mixed empty and non-empty strings', () => {
    const input = {
      planId: '',
      roomId: '',
      notes: 'Some notes',
      description: '',
    };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({
      planId: null,
      roomId: null,
      notes: 'Some notes',
      description: null,
    });
  });

  it('should handle objects with nested objects (does NOT recurse)', () => {
    const input = {
      name: '',
      address: {
        street: '',
        city: 'NYC',
      },
    };
    const result = nullifyEmptyStrings(input);
    // nullifyEmptyStrings only processes top-level keys, does NOT recurse
    expect(result.name).toBe(null);
    // address is kept as-is (the nested object with its empty street)
    expect(result.address).toEqual({ street: '', city: 'NYC' });
  });

  it('should handle undefined values', () => {
    const input = { name: 'John', nickname: undefined };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: 'John', nickname: undefined });
  });

  it('should preserve zero values', () => {
    const input = { name: '', count: 0 };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: null, count: 0 });
  });

  it('should preserve false boolean values', () => {
    const input = { name: '', active: false };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: null, active: false });
  });

  it('should handle string "0" (non-empty)', () => {
    const input = { value: '0' };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ value: '0' });
  });

  it('should handle whitespace strings (not empty)', () => {
    const input = { name: ' ', value: '\t' };
    const result = nullifyEmptyStrings(input);
    expect(result).toEqual({ name: ' ', value: '\t' });
  });

  it('should handle null input gracefully', () => {
    const result = nullifyEmptyStrings(null as any);
    expect(result).toBeNull();
  });
});
