import test from 'ava';
import { RouteRecordRaw } from 'vue-router';
import { routesToPaths } from '../src/node/utils.js';

test('Routes parsed to paths', t => {
    t.deepEqual(
        routesToPaths([
            {'path': 'foo'} as RouteRecordRaw
        ]), ['foo']
    );
});