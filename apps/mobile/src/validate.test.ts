import { describe, expect, it } from 'vitest';
import { firstName, greeting, isValidOtp, isValidPhone, validateWhen } from './validate';

const now = new Date(2026, 9, 4, 10, 0);
describe('input checks', () => {
  it('accepts only 10-digit Indian mobile numbers', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    for (const p of ['5876543210', '987654321', '98765432100', 'abcdefghij', '']) expect(isValidPhone(p)).toBe(false);
  });
  it('accepts only 6-digit codes', () => { expect(isValidOtp('123456')).toBe(true); expect(isValidOtp('12345')).toBe(false); expect(isValidOtp('12a456')).toBe(false); });
  it('validates the trip date and time', () => {
    expect(validateWhen('2026-10-05', '08:30', now)).toBeNull();
    expect(validateWhen('2026-10-04', '10:10', now)).toMatch(/30 minutes/);
    expect(validateWhen('2026-10-03', '08:30', now)).toMatch(/30 minutes/);
    expect(validateWhen('2026-02-30', '08:30', new Date(2026, 0, 1))).toMatch(/does not exist/);
    expect(validateWhen('2026-10-05', '25:00', now)).toMatch(/does not exist/);
    expect(validateWhen('05/10/2026', '08:30', now)).toMatch(/date/);
    expect(validateWhen('2026-10-05', '8.30', now)).toMatch(/time/);
  });
  it('greets by time of day and uses the first name', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
    expect(firstName('Ramandeep Kaur')).toBe('Ramandeep');
    expect(firstName(null)).toBe('there');
  });
});
