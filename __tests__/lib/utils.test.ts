import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('should merge class names into a single string', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle undefined and null values', () => {
    expect(cn(undefined, null, 'active')).toBe('active');
  });

  it('should handle conditional classes (falsy values)', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });

  it('should handle conditional classes (truthy values)', () => {
    expect(cn('base', true && 'active')).toBe('base active');
  });

  it('should merge conflicting Tailwind classes (last wins)', () => {
    // twMerge should resolve conflicting utilities: last one wins
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should merge conflicting padding utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('should merge conflicting margin utilities', () => {
    expect(cn('m-1', 'm-2')).toBe('m-2');
  });

  it('should merge conflicting text size utilities', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('should merge conflicting background colors', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('should keep non-conflicting classes', () => {
    expect(cn('flex', 'items-center', 'justify-between')).toBe('flex items-center justify-between');
  });

  it('should handle array inputs', () => {
    expect(cn(['flex', 'items-center'])).toBe('flex items-center');
  });

  it('should handle object inputs (truthy values, non-conflicting)', () => {
    // flex and items-center don't conflict; hidden (false) is excluded
    expect(cn({ 'flex': true, 'hidden': false, 'items-center': true })).toBe('flex items-center');
  });

  it('should resolve conflicting display utilities in objects', () => {
    // twMerge resolves conflicting display utilities: flex vs block, block wins
    expect(cn({ 'flex': true, 'block': true })).toBe('block');
  });

  it('should handle mixed input types', () => {
    const result = cn(
      'base-class',
      { 'active': true, 'disabled': false },
      undefined,
      ['extra-class'],
      'final-class'
    );
    expect(result).toContain('base-class');
    expect(result).toContain('active');
    expect(result).toContain('extra-class');
    expect(result).toContain('final-class');
    expect(result).not.toContain('disabled');
  });

  it('should handle empty strings', () => {
    expect(cn('base', '')).toBe('base');
  });

  it('should handle zero as a falsy value', () => {
    expect(cn('base', 0 && 'hidden')).toBe('base');
  });

  it('should merge conflicting rounded utilities', () => {
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg');
  });

  it('should merge conflicting width utilities', () => {
    expect(cn('w-4', 'w-8')).toBe('w-8');
  });

  it('should preserve responsive and state variant classes', () => {
    expect(cn('hover:bg-red-500', 'bg-blue-500')).toContain('hover:bg-red-500');
    expect(cn('hover:bg-red-500', 'bg-blue-500')).toContain('bg-blue-500');
  });

  it('should handle dark mode variants', () => {
    expect(cn('dark:bg-gray-900', 'bg-white')).toContain('dark:bg-gray-900');
    expect(cn('dark:bg-gray-900', 'bg-white')).toContain('bg-white');
  });

  it('should handle deeply nested arrays', () => {
    expect(cn(['a', ['b', 'c'], 'd'])).toBe('a b c d');
  });
});
