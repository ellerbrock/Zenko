const assert = require('assert');
const s3Client = require('../utils/s3SDK');
const { runAndCheckSearch, removeAllVersions } = require('../utils/helpers');

const userMetadata = { food: 'pizza' };
const updatedMetadata = { food: 'salad' };
const masterKey = 'master';

describe('Search in version enabled bucket', () => {
    const bucketName = `versionedbucket${Date.now()}`;
    const VersioningConfiguration = {
        MFADelete: 'Disabled',
        Status: 'Enabled',
    };
    before(done => {
        s3Client.createBucket({ Bucket: bucketName }, err => {
            if (err) {
                return done(err);
            }
            return s3Client.putBucketVersioning({ Bucket: bucketName,
                VersioningConfiguration }, err => {
                if (err) {
                    return done(err);
                }
                return s3Client.putObject({ Bucket: bucketName,
                    Key: masterKey, Metadata: userMetadata },
                    err => {
                        // give ingestion pipeline some time
                        setTimeout(() => done(err), 45000);
                    });
            });
        });
    });

    after(done => {
        removeAllVersions(s3Client, bucketName,
            err => {
                if (err) {
                    return done(err);
                }
                return s3Client.deleteBucket({ Bucket: bucketName }, done);
            });
    });

    it('should list just master object with searched for metadata', done => {
        const encodedSearch =
        encodeURIComponent('userMd.\`x-amz-meta-food\`' +
        `="${userMetadata.food}"`);
        return runAndCheckSearch(s3Client, bucketName,
            encodedSearch, masterKey, done);
    });

    describe('New version overwrite', () => {
        before(done => {
            s3Client.putObject({ Bucket: bucketName,
                Key: masterKey, Metadata: updatedMetadata },
                    err => {
                // give ingestion pipeline some time and make sure
                // cache expires (60 second cache expiry)
                        setTimeout(() => done(err), 75000);
                    });
        });

        it('should list just master object with updated metadata', done => {
            const encodedSearch =
            encodeURIComponent('userMd.\`x-amz-meta-food\`' +
            `="${updatedMetadata.food}"`);
            return runAndCheckSearch(s3Client, bucketName,
                encodedSearch, masterKey, done);
        });
    });
});