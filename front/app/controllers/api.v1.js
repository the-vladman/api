// Dependencies
var _         = require( 'underscore' );
var async     = require( 'async' );
var helpers   = require( '../../helpers' );
var mongoose  = require( 'mongoose' );
var uuid      = require( 'node-uuid' );
var NodeRSA   = require( 'node-rsa' );

// Required models
var Consumer   = mongoose.model( 'Consumer' );
var RSAKey     = mongoose.model( 'RSAKey' );

// DataObject schema
// Empty/flexible schema used to interact with different data
// collections as easyly as possible
var DataObjectSchema = new mongoose.Schema({}, {
  strict: false,
  read: 'nearest',
  versionKey: '_v',
  safe: {
    j: 1,
    w: 'majority'
  }
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
      async.waterfall([
        // Generate the API key for the new consumer
        function newAPIKey( cb ) {
          logger.debug( 'Creating new API key' );
          var rsa = new NodeRSA( { b: 1024 } );
          var apiKey = new RSAKey({
            fingerprint: helpers.rsaFingerprint( rsa.exportKey( 'public' ), true ),
            pub: helpers.base64Enc( rsa.exportKey( 'public' ) ),
            priv: helpers.base64Enc( rsa.exportKey() )
          });
          logger.debug( { apiKey: apiKey },'API key created' );
          
          apiKey.save( function( err ) {
            if( err ) {
              err = new Error( 'ERROR_CREATING_API_KEY' );
              return cb( err );
            }
            cb( null, apiKey );
          });
        },
        // Add the default access key, if any
        function addAccessKey( apiKey, cb ) {
          // Not present? just continue
          if( ! req.body.accessKey ) {
            return cb( null, apiKey, false );
          }
          
          // Validate and store provided key
          logger.debug( 'Registering default access key' );
          var userKey = new NodeRSA();
          try {
            // Validate key
            userKey.importKey( helpers.base64Dec( req.body.accessKey ) );
            if( ! userKey.isPublic() ) {
              var err = new Error( 'INVALID_PUBLIC_KEY' );
              err.status = 400;
              throw err;
            }
            
            // Store key
            var accessKey = new RSAKey({
              fingerprint: helpers.rsaFingerprint( userKey.exportKey( 'public' ), true ),
              pub: helpers.base64Enc( userKey.exportKey( 'public' ) )
            });
            
            logger.debug( { accessKey: accessKey }, 'Adding default access key' );
            accessKey.save( function( err ) {
              if( err ) {
                err = new Error( 'ERROR_STORING_ACCESS_KEY' );
                throw err;
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
            uuid: uuid.v4().toUpperCase(),
            apiKey: apiKey._id,
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
              .populate( function( err, consumer ) {
                if( err ) {
                  return cb( err );
                }
                return cb( null, consumer );
              });
          });
        }
      ], function( err, result ) {
        if( err ) {
          logger.fatal( { error: err }, 'Consumer registration error' );
          return next( err );
        }
        logger.debug( { result: result }, 'Consumer registration complete' );
        res.json( result );
      });
    },
    
    // Retrieve's a specific consumer details
    getConsumerInfo: function( req, res, next ) {
      logger.info( 'Getting consumer details' );
      
      // Run query with the provided ID
      Consumer.findById( req.params.id, function( err, consumer ) {
        if( err ) {
          return next( err );
        }
        
        if( ! consumer ) {
          var err = new Error( 'INVALID_CONSUMER_ID' );
          err.status = 400;
          return next( err );
        }
        
        // Populate apikey information
        consumer
          .populate( 'accessKeys', 'fingerprint -_id' )
          .populate( 'apiKey', 'fingerprint pub' )
          .populate( function( err, consumer ) {
            if( err ) {
              return next( err );
            }
            res.json( consumer );
          });
      });
    },
    
    // Adds a new access key for a given consumer
    // Required parameters:
    //   - accessKey: pub->base64
    addConsumerKey: function( req, res, next ) {
      logger.info( 'Add consumer key' );
      
      // Validate required parameters are present
      if( ! req.body.accessKey ) {
        var err = new Error( 'MISSING_PARAMETERS' );
        err.status = 400;
        return next( err );
      }
      
      // Retrieve consumer
      Consumer.findById( req.params.id, function( err, consumer ) {
        if( err ) {
          return next( err );
        }
        
        // Invalid ID check
        if( ! consumer ) {
          var err = new Error( 'INVALID_CONSUMER_ID' );
          err.status = 400;
          return next( err );
        }
        
        // Validate provided key
        var newKey = new NodeRSA();
        try {
          // Validate key
          newKey.importKey( helpers.base64Dec( req.body.accessKey ) );
          if( ! newKey.isPublic() ) {
            var err = new Error( 'INVALID_PUBLIC_KEY' );
            err.status = 400;
            throw err;
          }
        } catch( e ) {
          return next( e );
        }
        
        // Store key
        var accessKey = new RSAKey({
          fingerprint: helpers.rsaFingerprint( newKey.exportKey( 'public' ), true ),
          pub: helpers.base64Enc( newKey.exportKey( 'public' ) )
        });
        
        logger.debug( { accessKey: accessKey }, 'Adding new access key' );
        accessKey.save( function( err ) {
          if( err ) {
            return next( e );
          }
          
          // Update consumer record
          consumer.accessKeys.push( accessKey._id );
          consumer.save( function( err ) {
            if( err ) {
              return next( e );
            }
            
            res.json( accessKey );
            return;
          });
        });
      });
    },
    
    // Delete a given access key for a specific consumer
    delConsumerKey: function( req, res, next ) {
      logger.info( 'Delete consumer key' );
      
      async.waterfall([
        // Validate the provided consumer ID
        function validateConsumer( cb ) {
          Consumer.findById( req.params.id, function( err, consumer ) {
            if( err ) {
              return cb( err );
            }
            
            if( ! consumer ) {
              err = new Error( 'INVALID_CONSUMER_ID' );
              err.status = 400;
              return cb( err );
            }
        
            cb( null, consumer );
          });
        },
        // Validate the provided key id
        function validateKeyID( consumer, cb ) {
          if( consumer.accessKeys.indexOf( req.params.keyId ) < 0 ) {
            err = new Error( 'INVALID_KEY_ID' );
            err.status = 400;
            return cb( err );
          }
          
          RSAKey.remove({ _id: req.params.keyId }, function( err, key ) {
            if( err ) {
              err = new Error( 'ERROR_REMOVING_KEY' );
              return cb( err );
            }
            
            consumer.accessKeys.splice( consumer.accessKeys.indexOf( req.params.keyId ), 1 );
            consumer.save( function( err ) {
              if( err ) {
                err = new Error( 'ERROR_UPDATING_CONSUMER_RECORD' );
                return cb( err );
              }
              
              cb( null, consumer );
            });
          });
        }
      ],function( err, result ) {
        if( err ) {
          logger.fatal( { error: err }, 'Access key removal error' );
          return next( err );
        }
        logger.debug( { result: result }, 'Access key removal complete' );
        res.json( result );
      });
    },
    
    // Run a general data query
    runQuery: function( req, res, next ) {
      logger.info( 'Run query' );
      
      // Validate collection
      var collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) == 'sys.' ) {
        var err = new Error( 'RESTRICTED_DATA_COLLECTION' );
        err.status = 400;
        return next( err );
      }
      
      // Adjust model to run-time requirements
      DataObjectSchema.set( 'collection', collection );
      var DataObject = mongoose.model( 'DataObject', DataObjectSchema );
      
      // Run query
      DataObject.find( req.query, function( err, docs ) {
        if( err ) {
          return next( err );
        }
        
        res.json( docs );
      });
    },
    
    // Retrieve a specific data document
    getDocument: function( req, res, next ) {
      logger.info( 'Retrieve document' );
      
      // Validate collection
      var collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) == 'sys.' ) {
        var err = new Error( 'RESTRICTED_DATA_COLLECTION' );
        err.status = 400;
        return next( err );
      }
      
      // Adjust model to run-time requirements
      DataObjectSchema.set( 'collection', collection );
      var DataObject = mongoose.model( 'DataObject', DataObjectSchema );
      
      // Try to retrieve the requested document
      DataObject.findById( req.params.docId, function( err, doc ) {
        if( err ) {
          return next( err );
        }
        
        if( ! doc ) {
          err = new Error( 'INVALID_DOCUMENT_ID' );
          err.status = 400;
          return next( err );
        }
        
        res.json( doc );
      });
    },
    
    // Register a new data record/document
    registerDocument: function( req, res, next ) {
      logger.info( 'Register document' );
      
      // Validate collection
      var collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) == 'sys.' ) {
        var err = new Error( 'RESTRICTED_DATA_COLLECTION' );
        err.status = 400;
        return next( err );
      }
      
      // Validate there's data to work with
      if( _.isEmpty( req.body ) ) {
        var err = new Error( 'NO_DATA_PROVIDED' );
        err.status = 400;
        return next( err );
      }
      
      // Adjust model to run-time requirements
      DataObjectSchema.set( 'collection', collection );
      var DataObject = mongoose.model( 'DataObject', DataObjectSchema );
      
      // Create and store document
      var doc = new DataObject( req.body );
      doc.save( function( err ) {
        if( err ) {
          return next( err );
        }
        
        res.json( doc );
      });
    },
    
    // Update a specific data document
    updateDocument: function( req, res, next ) {
      logger.info( 'Update document' );
      
      // Validate collection
      var collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) == 'sys.' ) {
        var err = new Error( 'RESTRICTED_DATA_COLLECTION' );
        err.status = 400;
        return next( err );
      }
      
      // Validate there's data to work with
      if( _.isEmpty( req.body ) ) {
        var err = new Error( 'NO_DATA_PROVIDED' );
        err.status = 400;
        return next( err );
      }
      
      // Adjust model to run-time requirements
      DataObjectSchema.set( 'collection', collection );
      var DataObject = mongoose.model( 'DataObject', DataObjectSchema );
      
      // Try to retrieve and update the requested document
      DataObject.findByIdAndUpdate( req.params.docId, req.body, { new: true }, function( err, doc ) {
        if( err ) {
          return next( err );
        }
        
        if( ! doc ) {
          err = new Error( 'INVALID_DOCUMENT_ID' );
          err.status = 400;
          return next( err );
        }
        
        res.json( doc );
      });
    },
    
    // Delete a specific data document
    delDocument: function( req, res, next ) {
      logger.info( 'Delete document' );
      
      // Validate collection
      var collection = req.params.dataCollection;
      if( collection.substr( 0, 4 ) == 'sys.' ) {
        var err = new Error( 'RESTRICTED_DATA_COLLECTION' );
        err.status = 400;
        return next( err );
      }
      
      // Adjust model to run-time requirements
      DataObjectSchema.set( 'collection', collection );
      var DataObject = mongoose.model( 'DataObject', DataObjectSchema );
      
      // Try to select and remove the requested document
      DataObject.findByIdAndRemove( req.params.docId, function( err, doc ) {
        if( err ) {
          return next( err );
        }
        
        if( ! doc ) {
          err = new Error( 'INVALID_DOCUMENT_ID' );
          err.status = 400;
          return next( err );
        }
        
        res.json( doc );
      });
    }
  }
}
