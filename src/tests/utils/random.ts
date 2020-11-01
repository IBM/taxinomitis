/*eslint-env mocha */
import * as assert from 'assert';

import * as random from '../../lib/utils/random';



describe('Utils - random', () => {


    it('should generate 2 random numbers that sum to 100', () => {
        const nums = random.ints(2);
        assert.strictEqual(nums.length, 2);
        assert.strictEqual(nums[0] + nums[1], 100);
    });

    it('should generate 3 random numbers that sum to 100', () => {
        const nums = random.ints(3);
        assert.strictEqual(nums.length, 3);
        assert.strictEqual(nums[0] + nums[1] + nums[2], 100);
    });

    it('should generate 4 random numbers that sum to 100', () => {
        const nums = random.ints(4);
        assert.strictEqual(nums.length, 4);
        assert.strictEqual(nums[0] + nums[1] + nums[2] + nums[3], 100);
    });

    it('should generate 5 random numbers that sum to 100', () => {
        const nums = random.ints(5);
        assert.strictEqual(nums.length, 5);
        assert.strictEqual(nums[0] + nums[1] + nums[2] + nums[3] + nums[4], 100);
    });

    it('should generate 6 random numbers that sum to 100', () => {
        const nums = random.ints(6);
        assert.strictEqual(nums.length, 6);
        assert.strictEqual(nums[0] + nums[1] + nums[2] + nums[3] + nums[4] + nums[5], 100);
    });

});
