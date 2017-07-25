var fs = require('fs');
var path = require('path');
var request = require('request');
var archiver = require('archiver');
var async = require('async');
var readChunk = require('read-chunk');
var fileType = require('file-type');
var tmp = require('tmp');




function getFileType(filepath, callback) {
    readChunk(filepath, 0, 4100)
        .then((buffer) => {
            const type = fileType(buffer);
            callback(null, type ? type.ext : 'unknown');
        })
        .catch(callback);
}


function download(url, callback) {
    async.waterfall([
        function (next) {
            tmp.file({ keep : true }, function (err, name) {
                next(err, name);
            });
        },
        function (tmpFilename, next) {
            request.get({ url, timeout : 5000 })
                .on('error', function (err) {
                    next(err);
                })
                .on('end', function () {
                    next(null, tmpFilename);
                })
                .pipe(fs.createWriteStream(tmpFilename));
        },
        function (tmpFilename, next) {
            getFileType(tmpFilename, function (err, correctExtension) {
                if (correctExtension === 'jpg' || correctExtension === 'png') {
                    next(err, tmpFilename, correctExtension);
                }
                else {
                    next(new Error('Training data (' + url + ') has unsupported file type (' + correctExtension + ')'));
                }
            });
        },
        function (tmpFilename, correctExtension, next) {
            const newFileName = tmpFilename + '.' + correctExtension;
            fs.rename(tmpFilename, newFileName, function (err) {
                next(err, newFileName);
            });
        }
    ], callback);
}




function deleteAll(filenames, callback) {
    async.each(filenames, fs.unlink, callback);
}



function downloadAll(urls, callback) {
    async.map(urls, function (item, cb) {
        download(item, function (err, filename) {
            if (err) {
                return cb(err);
            }
            cb(null, filename);
        });
    }, callback);
}



function zipFiles(zipfilename, filesToZip, callback) {

    var output = fs.createWriteStream(zipfilename);

    var archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
        callback(null, zipfilename, archive.pointer(), filesToZip);
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
        console.log('WARNING');
        console.log(err);
        callback(err);
    });

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
        console.log('ERROR');
        console.log(err);
        callback(err);
    });

    archive.pipe(output);

    filesToZip.forEach(function (filepath) {
        archive.file(filepath, { name : path.basename(filepath) });
    });

    archive.finalize();
}




function createZip(urls, callback) {
    if (urls.length < 10) {
        return callback(new Error('Not enough images to train the classifier'));
    }
    if (urls.length > 10000) {
        return callback(new Error('Number of images exceeds maximum (10000)'));
    }

    async.waterfall([
        function (next) {
            tmp.file({ keep : true, postfix : '.zip' }, function (err, zipfilename) {
                if (err) {
                    return next(err);
                }
                return next(null, zipfilename);
            });
        },
        function (zipfilename, next) {
            downloadAll(urls, function (err, downloadedFiles) {
                if (err) {
                    return next(err);
                }

                next(null, zipfilename, zipfilesize, downloadedFiles);
            });
        },
        zipFiles,
        function (zipfilename, zipfilesize, filesToDelete, next) {
            deleteAll(filesToDelete, function (err) {
                if (err) {
                    return next(err);
                }
                return next(null, zipfilename, zipfilesize);
            });
        },
        function (zipfile, filesize, next) {
            if (filesize > 100000000) {
                return next(new Error('Training data exceeds maximum limit (100 mb)'));
            }
            return next(null, zipfile);
        }
    ], callback);
}



createZip([
    'https://static.pexels.com/photos/170811/pexels-photo-170811.jpeg',
    'http://blog.caranddriver.com/wp-content/uploads/2015/11/BMW-2-series.jpg',
    'http://blog.caranddriver.com/wp-content/uploads/2016/11/Mazda-MX-5-Miata-lead.jpg',
    'http://a57.foxnews.com/images.foxnews.com/content/fox-business/features/2016/12/29/most-interesting-cars-2017/_jcr_content/par/featured-media/media-0.img.jpg/932/470/1481816370871.jpg',
    'http://i2.cdn.cnn.com/cnnnext/dam/assets/161212145759-best-cars-2016-bugatti-1-super-169.jpg',
    'https://media.ed.edmunds-media.com/honda/cr-v/2017/oem/2017_honda_cr-v_4dr-suv_touring_fq_oem_14_717.jpg',
    'http://blog.caranddriver.com/wp-content/uploads/2016/11/BMW-M2-lead.jpg',
    // 'http://pngimg.com/uploads/lamborghini/lamborghini_PNG10704.png',
    // 'http://media.caranddriver.com/images/media/51/25-cars-worth-waiting-for-lp-2016-porsche-cayman-gt4-photo-658255-s-original.jpg',
    // 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Bugatti_Veyron_16.4_Super_Sport_-_Flickr_-_Supermac1961.jpg/1200px-Bugatti_Veyron_16.4_Super_Sport_-_Flickr_-_Supermac1961.jpg',
    // 'http://blog.caranddriver.com/wp-content/uploads/2016/11/Mazda-3-lead.jpg',
    // 'http://media.caranddriver.com/images/media/672263/2017-toyota-corolla-in-depth-model-review-car-and-driver-photo-681159-s-450x274.jpg',
    // 'http://www.lotuscars.com/sites/all/themes/lotus_obb/img/exige380hero.jpg',
    // 'http://www.telegraph.co.uk/cars/images/2017/04/13/3008-xlarge_trans_NvBQzQNjv4BqBOBZnbR0ZUdl4Tdt1XA1QnTnUHgeKGeBkC7r84Gj99Y.jpg'
], function (err, zipfile) {
    if (err) {
        console.log('failed');
        return console.log(err);
    }
    console.log('cars : ' + zipfile);
});


