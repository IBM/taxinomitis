#!/usr/bin/env node

/** Copy TensorFlow.js and related ML libraries */

const fs = require('fs');
const path = require('path');
const { ensureDir, downloadFile } = require('./utils');

console.log('Setting up TensorFlow.js and ML libraries...');

const baseDir = path.join(__dirname, '..');
const bowerDir = path.join(baseDir, 'web', 'static', 'bower_components');

console.log('  Copying TensorFlow.js...');
const tfjsSrc = path.join(baseDir, 'node_modules', '@tensorflow', 'tfjs', 'dist');
const tfjsDest = path.join(bowerDir, 'tfjs');
ensureDir(tfjsDest);
['tf.js', 'tf.min.js', 'tf.min.js.map'].forEach(file => {
    const src = path.join(tfjsSrc, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tfjsDest, file));
    }
});

console.log('  Copying YDF Inference...');
const ydfSrc = path.join(baseDir, 'node_modules', 'ydf-inference', 'dist');
const ydfDest = path.join(bowerDir, 'ydf-inference');
ensureDir(ydfDest);
['inference.js', 'inference.wasm'].forEach(file => {
    const src = path.join(ydfSrc, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(ydfDest, file));
    }
});
// jszip dependency for ydf-inference
const jszipSrc = path.join(baseDir, 'node_modules', 'jszip', 'dist', 'jszip.min.js');
fs.copyFileSync(jszipSrc, path.join(ydfDest, 'jszip.min.js'));

console.log('  Copying PoseNet...');
const posenetSrc = path.join(baseDir, 'node_modules', 'tensorflow-models-posenet', 'dist', 'posenet.min.js');
const posenetDest = path.join(bowerDir, 'tensorflow-models', 'posenet');
ensureDir(posenetDest);
fs.copyFileSync(posenetSrc, path.join(posenetDest, 'posenet.min.js'));

console.log('  Copying Speech Commands...');
const speechSrc = path.join(baseDir, 'node_modules', 'tensorflow-models-speech-commands', 'dist', 'speech-commands.min.js');
const speechDest = path.join(bowerDir, 'tensorflow-models', 'speech-commands');
const speechDestScratch = path.join(bowerDir, 'tensorflow-models', 'speech-commands-scratch');
ensureDir(speechDest);
ensureDir(speechDestScratch);
fs.copyFileSync(speechSrc, path.join(speechDest, 'speech-commands.min.js'));
fs.copyFileSync(speechSrc, path.join(speechDestScratch, 'speech-commands.min.js'));

console.log('  Copying Face Landmarks Detection...');
const faceSrc = path.join(baseDir, 'node_modules', 'tensorflow-models-face-landmarks-detection', 'dist', 'face-landmarks-detection.min.js');
const faceDest = path.join(bowerDir, 'tensorflow-models', 'face-landmarks-detection');
ensureDir(faceDest);
fs.copyFileSync(faceSrc, path.join(faceDest, 'face-landmarks-detection.min.js'));

console.log('  Copying Face Mesh...');
const faceMeshSrc = path.join(baseDir, 'node_modules', '@mediapipe', 'face_mesh');
const faceMeshDest = path.join(bowerDir, 'tensorflow-models', 'face-mesh');
ensureDir(faceMeshDest);
fs.readdirSync(faceMeshSrc).forEach(file => {
    fs.copyFileSync(path.join(faceMeshSrc, file), path.join(faceMeshDest, file));
});

console.log('  Copying Handpose...');
const handposeSrc = path.join(baseDir, 'node_modules', 'tensorflow-models-handpose', 'dist', 'handpose.min.js');
const handposeDest = path.join(bowerDir, 'tensorflow-models', 'handpose');
ensureDir(handposeDest);
fs.copyFileSync(handposeSrc, path.join(handposeDest, 'handpose.min.js'));

console.log('  Downloading PoseNet model...');
async function downloadPoseNetModel() {
    const files = [
        { url: 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/model-stride16.json', file: 'model-multiplier75-stride16.json' },
        { url: 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard1of2.bin', file: 'group1-shard1of2.bin' },
        { url: 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard2of2.bin', file: 'group1-shard2of2.bin' }
    ];
    for (const { url, file } of files) {
        const destPath = path.join(posenetDest, file);
        if (!fs.existsSync(destPath)) {
            await downloadFile(url, destPath);
        }
    }
}

console.log('  Downloading Speech Commands model...');
async function downloadSpeechCommandsModel() {
    const files = [
        { url: 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/metadata.json', file: 'metadata.json' },
        { url: 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/model.json', file: 'model.json' },
        { url: 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard1of2', file: 'group1-shard1of2' },
        { url: 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/group1-shard2of2', file: 'group1-shard2of2' }
    ];
    for (const { url, file } of files) {
        const destPath = path.join(speechDest, file);
        const destPathScratch = path.join(speechDestScratch, file);
        if (!fs.existsSync(destPath)) {
            await downloadFile(url, destPath);
        }
        if (!fs.existsSync(destPathScratch)) {
            await downloadFile(url, destPathScratch);
        }
    }
}

console.log('  Downloading Image Recognition model...');
async function downloadImageRecognitionModel() {
    const imageRecogDest = path.join(bowerDir, 'tensorflow-models', 'image-recognition');
    const imageRecogDestScratch = path.join(bowerDir, 'tensorflow-models', 'image-recognition-scratch');
    ensureDir(imageRecogDest);
    ensureDir(imageRecogDestScratch);

    const files = [
        { url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json', file: 'model.json' }
    ];
    for (let x = 1; x <= 55; x++) {
        const filename = 'group' + x + '-shard1of1';
        files.push({
            url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/' + filename,
            file: filename
        });
    }
    for (const { url, file } of files) {
        const destPath = path.join(imageRecogDest, file);
        const destPathScratch = path.join(imageRecogDestScratch, file);
        if (!fs.existsSync(destPath)) {
            await downloadFile(url, destPath);
        }
        if (!fs.existsSync(destPathScratch)) {
            await downloadFile(url, destPathScratch);
        }
    }
}

(async () => {
    try {
        await downloadPoseNetModel();
        await downloadSpeechCommandsModel();
        await downloadImageRecognitionModel();
        console.log('TensorFlow.js setup complete');
    } catch (error) {
        console.error('Error downloading models:', error);
        process.exit(1);
    }
})();
