import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationEnabled} from '../src/lib/secureCheckout';
test('navigation requires explicit flag and production or staging mode',()=>{assert.equal(navigationEnabled(),process.env.EXPECT_NAVIGATION==='true');});
