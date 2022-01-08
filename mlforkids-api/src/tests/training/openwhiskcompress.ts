/*eslint-env mocha */

import * as assert from 'assert';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as numbers from '../../lib/training/numbers';



describe('Compression for OpenWhisk calls', () => {

    it('should compress training data with multi-choice fields', () => {
        const trainingdatastr = fs.readFileSync('./src/tests/training/resources/tictactoe.json', 'utf-8');
        const trainingdata = JSON.parse(trainingdatastr);
        const compressed = numbers.compress(trainingdata as numbers.UncompressedTrainingData);
        const target = tmp.fileSync();
        fs.writeFileSync(target.name, JSON.stringify(compressed));
        const decompresseddata = fs.readFileSync(target.name, 'utf-8');
        const decompressed = JSON.parse(decompresseddata);
        const roundtrip = numbers.decompress(decompressed);
        assert.deepStrictEqual(trainingdata, roundtrip);
    });

    it('should compress training data with numeric fields', () => {
        const trainingdatastr = fs.readFileSync('./src/tests/training/resources/bigorsmall.json', 'utf-8');
        const trainingdata = JSON.parse(trainingdatastr);
        const compressed = numbers.compress(trainingdata as numbers.UncompressedTrainingData);
        const target = tmp.fileSync();
        fs.writeFileSync(target.name, JSON.stringify(compressed));
        const decompresseddata = fs.readFileSync(target.name, 'utf-8');
        const decompressed = JSON.parse(decompresseddata);
        const roundtrip = numbers.decompress(decompressed);
        assert.deepStrictEqual(trainingdata, roundtrip);
    });

});
