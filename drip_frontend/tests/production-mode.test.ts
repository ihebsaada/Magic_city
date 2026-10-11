import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationEnabled} from '@/lib/navigationHandoff';
test('navigation requires explicit flag and production or staging mode',()=>{assert.equal(navigationEnabled(),process.env.EXPECT_NAVIGATION==='true');});
