// Enable strict syntax mode
'use strict';

// Dependencies
var _ = require( 'underscore' );
var async = require( 'async' );
var helpers = require( '../../helpers' );
var mongoose = require( 'mongoose' );
var uuid = require( 'node-uuid' );
var NodeRSA = require( 'node-rsa' );

// Required models
var Consumer = mongoose.model( 'Consumer' );
var RSAKey = mongoose.model( 'RSAKey' );

// DataObject schema
// Empty/flexible schema used to interact with different data
// collections as easyly as possible
var DataObjectSchema = new mongoose.Schema({}, {
  strict:     false,
  read:       'nearest',
  versionKey: '_v',
  safe:       { j: 1, w: 'majority' }
});

// Controller definition
module.exports = function( options ) {
  // Local logger accesor
  var logger = options.logger;

  // Public controller interface
  return {
    // Register a new API consumer
    // Optional params:
    //   - details: {}
    //   - accessKey: pub->base64
    registerConsumer: function( req, res, next ) {
      logger.info( 'Registering a new API cosumer' );

      // Consumer creation process
      async.waterfall( [
        // Generate the API key for the new consumer
        function newAPIKey( cb ) {
          var rsa = new NodeRSA({ b: 1024 });
          var apiKey = new RSAKey({
            fingerprint: helpers.rsaFingerprint( rsa.exportKey( 'public' ), true ),
            pub:         helpers.base64Enc( rsa.exportKey( 'public' ) ),
            priv:        helpers.base64Enc( rsa.exportKey() )
          });

          logger.debug({ apiKey: apiKey }, 'API key created' );
          apiKey.save( function( err ) {
            if( err ) {
              return cb( new Error( 'ERROR_CREATING_API_KEY' ) );
            }
            cb( null, apiKey );
          });
        },
        // Add the default access key, if any
        function addAccessKey( apiKey, cb ) {
          var userKey;
          var accessKey;
          var error = null;

          // Not present? just continue
          if( ! req.body.accessKey ) {
            return cb( null, apiKey, false );
          }

          // Validate and store provided key
          logger.debug( 'Registering default access key' );
          userKey = new NodeRSA();
          try {
            // Validate key
            userKey.importKey( helpers.base64Dec( req.body.accessKey ) );
            if( ! userKey.isPublic() ) {
              error = new Error( 'INVALID_PUBLIC_KEY' );
              error.status = 400;
              throw error;
            }

            // Store key
            accessKey = new RSAKey({
              fingerprint: helpers.rsaFingerprint( userKey.exportKey( 'public' ), true ),
              pub:         helpers.base64Enc( userKey.exportKey( 'public' ) )
            });

            logger.debug({ accessKey: accessKey }, 'Adding default access key' );
            accessKey.save( function( err ) {
              if( err ) {
                throw new Error( 'ERROR_STORING_ACCESS_KEY' );
              }
              cb( null, apiKey, accessKey._id );
            });
          } catch( e ) {
            // Continue
            logger.fatal({ key: req.body.accessKey, error: e }, 'Invalid key provided' );
            return cb( null, apiKey, false );
          }
        },
        // Store the new consumer record
        function saveConsumer( apiKey, accessKey, cb ) {
          var consumer = new Consumer({
            uuid:    uuid.v4().toUpperCase(),
            apiKey:  apiKey._id,
            details: req.body.details || {}
          });

          // Add the default accesskey if present
          if( accessKey ) {
            consumer.accessKeys.push( accessKey );
          }

          consumer.save( function( err ) {
            if( err ) {
              return cb( err );
            }
            logger.debug( 'New consumer registered' );
            consumer
              .populate( 'accessKeys', 'fingerprint pub' )
              .populate( 'apiKey', 'fingerprint pub' )
              .populate( function( error, doc ) {
                if( error ) {
                  return cb( error );
                }
                return cb( null, doc );
              });
          });
        }
      ], function( err, result ) {
        if( err ) {
          logger.fatal({ error: err }, 'Consumer registration error' );
          return next( err );
        }
        logger.debug({ result: result }, 'Consumer registration complete' );
        res.json( result );
      });
    },

    // Retrieve's a specific consumer details
    getConsumerInfo: function( req, res, next ) {
      var error;

      // Run query with the provided ID
      logger.info( 'Getting consumer details' );
      Consumer.findById( req.params.id, function( err, consumer ) {
        if( err ) {
          return next( err );
        }

        if( ! consumer ) {
          error = new Error( 'INVALID_CONSUMER_ID' );
          error.status = 400;
          return next( error );
        }

        // Populate apikey information
        consumer
          .populate( 'accessKeys', 'fingerprint -_id' )
          .populate( 'apiKey', 'fingerprint pub' )
          .populate( function( err2, doc ) {
            if( err2 ) {
              return next( err2 );
            }
            res.json( doc );
          });
      });
    },

    // Adds a new access key for a given consumer
    // Required parameters:
    //   - accessKey: pub->base64
    addConsumerKey: function( req, res, next ) {
      var error;
      var newKey;
      var accessKey;

      // Validate required parameters are present
      logger.info( 'Add consumer key' );
      if( ! req.body.accessKey ) {
        error = new Error( 'MISSING_PARAMETERS' );
        error.status = 400;
        return next( error );
      }

      // Retrieve consumer
      Consumer.findById( req.params.id, function( err, consumer ) {
        if( err ) {
          return next( err );
        }

        // Invalid ID check
        if( ! consumer ) {
          error = new Error( 'INVALID_CONSUMER_ID' );
          error.status = 400;
          return next( error );
        }

        // Validate provided key
        newKey = new NodeRSA();
        try {
          // Validate key
          newKey.importKey( helpers.base64Dec( req.body.accessKey ) );
          if( ! newKey.isPublic() ) {
            error = new Error( 'INVALID_PUBLIC_KEY' );
            error.status = 400;
            throw error;
          }
        } catch( e ) {
          return next( e );
        }

        // Store key
        accessKey = new RSAKey({
          fingerprint: helpers.rsaFingerprint( newKey.exportKey( 'public' ), true ),
          pub:         helpers.base64Enc( newKey.exportKey( 'public' ) )
        });

        logger.debug({ accessKey: accessKey }, 'Adding new access key' );
        accessKey.save( function( err2 ) {
          if( err2 ) {
            return next( err2 );
          }

          // Update consumer record
          consumer.accessKeys.push( accessKey._id );
          consumer.save( function( err3 ) {
            if( err3 ) {
              return next( err3 );
            }

            res.json( accessKey );
            // return;
          });
        });
      });
    },

    // Delete a given access key for a specific consumer
    delConsumerKey: function( req, res, next ) {
      var error;

      logger.info( 'Delete consumer key' );
      async.waterfall( [
        // Validate the provided consumer ID
        function validateConsumer( cb ) {
          Consumer.findById( req.params.id, function( err, consumer ) {
            if( err ) {
              return cb( err );
            }

            if( ! consumer ) {
              error = new Error( 'INVALID_CONSUMER_ID' );
              error.status = 400;
              return cb( error );
            }

            cb( null, consumer );
          });
        },
        // Validate the provided key id
        function validateKeyID( consumer, cb ) {
          if( consumer.accessKeys.indexOf( req.params.keyId ) < 0 ) {
            error = new Error( 'INVALID_KEY_ID' );
            error.status = 400;
            return cb( error );
          }

          RSAKey.remove({ _id: req.params.keyId }, function( err, key ) {
            if( err ) {
              return cb( new Error( 'ERROR_REMOVING_KEY' ) );
            }

            consumer.accessKeys.splice( consumer.accessKeys.indexOf( key._id ), 1 );
            consumer.save( function( err2 ) {
              if( err2 ) {
                return cb( new Error( 'ERROR_UPDATING_CONSUMER_RECORD' ) );
              }

              cb( null, consumer );
            });
          });
        }
      ], function( err, result ) {
        if( err ) {
          logger.fatal({ error: err }, 'Access key removal error' );
          return next( err );
        }
        logger.debug({ result: result }, 'Access key removal complete' );
        res.json( result );
      });
    },

    // Run a general data query
    runQuery: function( req, res, next ) {
      var error;
      var collection = req.params.dataCollection;
      var DataObject;
      var query;
      var queryString;
      var page;
      var pageSize;

      // Validate collection
      logger.info( 'Run query' );
      if( collection.substr( 0, 4 ) === 'sys.' ) {
        error = new Error( 'RESTRICTED_DATA_COLLECTION' );
        error.status = 400;
        return next( error );
      }

      // Adjust model to run-time requirements
      DataObject = mongoose.model( 'DataObject', DataObjectSchema, collection );

      // Pagination variables
      queryString = req.query;
      page = queryString.page || 1;
      pageSize = queryString.pageSize || 100;
      delete queryString.page;
      delete queryString.pageSize;

      // Get query object and set pagination records
      query = DataObject.find( queryString );
      DataObject.find( queryString ).count( function( err, total ) {
        if( err ) {
          return next( err );
        }

        query
          .skip( ( page - 1 ) * pageSize )
          .limit( pageSize );

        // Run query
        query.exec( function( err2, docs ) {
          if( err2 ) {
            return next( err2 );
          }

          res.json({
            results:    docs,
            pagination: {
              page:     page,
              pageSize: pageSize,
              total:    total
            }
          });
        });
      });
    },

    // Retrieve a specific data document
    getDocument: function( req, res, next ) {
      var collection;
      var error;
      var DataObject;

      // Validate collection
      logger.info( 'Retrieve document' );
      collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) === 'sys.' ) {
        error = new Error( 'RESTRICTED_DATA_COLLECTION' );
        error.status = 400;
        return next( error );
      }

      // Adjust model to run-time requirements
      DataObject = mongoose.model( 'DataObject', DataObjectSchema, collection );

      // Try to retrieve the requested document
      DataObject.findById( req.params.docId, function( err, doc ) {
        if( err ) {
          return next( err );
        }

        if( ! doc ) {
          error = new Error( 'INVALID_DOCUMENT_ID' );
          error.status = 400;
          return next( error );
        }

        res.json( doc );
      });
    },

    // Register a new data record/document
    registerDocument: function( req, res, next ) {
      var collection;
      var error;
      var DataObject;
      var doc;

      // Validate collection
      logger.info( 'Register document' );
      collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) === 'sys.' ) {
        error = new Error( 'RESTRICTED_DATA_COLLECTION' );
        error.status = 400;
        return next( error );
      }

      // Validate there's data to work with
      if( _.isEmpty( req.body ) ) {
        error = new Error( 'NO_DATA_PROVIDED' );
        error.status = 400;
        return next( error );
      }

      // Adjust model to run-time requirements
      DataObject = mongoose.model( 'DataObject', DataObjectSchema, collection );

      // Create and store document
      doc = new DataObject( req.body );
      doc.save( function( err ) {
        if( err ) {
          return next( err );
        }

        res.json( doc );
      });
    },

    // Update a specific data document
    updateDocument: function( req, res, next ) {
      var collection;
      var error;
      var DataObject;
      var docId = req.params.docId;

      // Validate collection
      logger.info( 'Update document' );
      collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) === 'sys.' ) {
        error = new Error( 'RESTRICTED_DATA_COLLECTION' );
        error.status = 400;
        return next( error );
      }

      // Validate there's data to work with
      if( _.isEmpty( req.body ) ) {
        error = new Error( 'NO_DATA_PROVIDED' );
        error.status = 400;
        return next( error );
      }

      // Adjust model to run-time requirements
      DataObject = mongoose.model( 'DataObject', DataObjectSchema, collection );

      // Try to retrieve and update the requested document
      /* eslint no-reserved-keys:0 */
      DataObject.findByIdAndUpdate( docId, req.body, { new: true }, function( err, doc ) {
        if( err ) {
          return next( err );
        }

        if( ! doc ) {
          error = new Error( 'INVALID_DOCUMENT_ID' );
          error.status = 400;
          return next( error );
        }

        res.json( doc );
      });
    },

    // Delete a specific data document
    delDocument: function( req, res, next ) {
      var collection;
      var error;
      var DataObject;
      var docId = req.params.docId;

      // Validate collection
      logger.info( 'Delete document' );
      collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) === 'sys.' ) {
        error = new Error( 'RESTRICTED_DATA_COLLECTION' );
        error.status = 400;
        return next( error );
      }

      // Adjust model to run-time requirements
      DataObject = mongoose.model( 'DataObject', DataObjectSchema, collection );

      // Try to select and remove the requested document
      DataObject.findByIdAndRemove( docId, function( err, doc ) {
        if( err ) {
          return next( err );
        }

        if( ! doc ) {
          error = new Error( 'INVALID_DOCUMENT_ID' );
          error.status = 400;
          return next( err );
        }

        res.json( doc );
      });
    }
  };
};
