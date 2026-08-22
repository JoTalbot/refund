import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, canTransition } from '../src/index.js';

test('allows a reviewed return submission', () => assert.equal(canTransition('submitted_for_approval', 'approved_for_submission'), true));
test('does not allow a resolved case to restart', () => assert.equal(canTransition('resolved', 'draft'), false));
test('throws for prohibited transition', () => assert.throws(() => assertTransition('draft', 'resolved')));
