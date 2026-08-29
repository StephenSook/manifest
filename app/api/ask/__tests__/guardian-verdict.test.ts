// Verdict corpus measured against production granite-guardian-3-8b on
// 2026-08-29 (one full 34-question live run plus a grounded/ungrounded
// probe pair). Every artifact string below was actually emitted.
import { describe, expect, it } from 'vitest';
import { parseGuardianVerdict } from '../lib';

describe('parseGuardianVerdict', () => {
  it('reads the role-glued PASS the model actually emits', () => {
    expect(parseGuardianVerdict('\nassistantPASS')).toBe('pass');
    expect(parseGuardianVerdict('ASSISTANTPASS')).toBe('pass');
    expect(parseGuardianVerdict('PASS')).toBe('pass');
  });

  it('reads the role-glued FAIL the model actually emits', () => {
    expect(parseGuardianVerdict('\nassistantFAIL')).toBe('fail');
    expect(parseGuardianVerdict('ASSISTANTFAIL')).toBe('fail');
    expect(parseGuardianVerdict('FAIL')).toBe('fail');
  });

  it('FAIL anywhere wins over PASS', () => {
    expect(
      parseGuardianVerdict('The answer would PASS on tone but must FAIL on grounding'),
    ).toBe('fail');
    expect(parseGuardianVerdict('FAILPASS')).toBe('fail');
  });

  it('finds a verdict after the safety-template preamble', () => {
    expect(
      parseGuardianVerdict(
        'Our safety risk definition is defined as follows. The answer is supported. PASS',
      ),
    ).toBe('pass');
    expect(
      parseGuardianVerdict(
        'Our safety risk definition is defined as follows. Unsupported claims found. FAIL',
      ),
    ).toBe('fail');
  });

  it('a truncated preamble with no verdict token is no-verdict, never a pass', () => {
    expect(parseGuardianVerdict('OUR SAFETY RISK DEFINITION IS DEFINED')).toBe('no-verdict');
  });

  it('the native Yes/No space is not mapped in either direction', () => {
    // "No" is ambiguous between "no, not supported" (fail) and "no risk
    // found" (pass); mapping it would guess a safety direction. Measured
    // live: assistantNO appeared twice in one 34-question run.
    expect(parseGuardianVerdict('assistantNO')).toBe('no-verdict');
    expect(parseGuardianVerdict('No')).toBe('no-verdict');
    expect(parseGuardianVerdict('Yes')).toBe('no-verdict');
  });

  it('empty output is no-verdict', () => {
    expect(parseGuardianVerdict('')).toBe('no-verdict');
    expect(parseGuardianVerdict('   ')).toBe('no-verdict');
  });
});
