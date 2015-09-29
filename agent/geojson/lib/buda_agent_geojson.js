// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var _ = require( 'underscore' );
var util = require( 'util' );
var mongoose = require( 'mongoose' );
var JSONStream = require( 'JSONStream' );
var GJV = require( 'geojson-validation' );
var info = require( '../package' );

// Storage schema basic definiton
var Doc;
var storage = null;
var StorageSchema = new mongoose.Schema({});

// Private utility method
// Coords should be stored as long,lat; no altitude element included
function removeAltitude( coords ) {
  _.each( coords, function( item ) {
    if( _.isArray( item ) ) {
      // Recursive call for nested arrays at any depth
      removeAltitude( item );
    }

    // If the coords data has three elements,
    // remove the last one ( altitude )
    if( coords.length === 3 ) {
      coords.pop();
    }
  });
}

// Private utility method
// Remove duplicate points in the coords, except for the first/last
// MongoDB fails to index otherwise
function removeDups( coords ) {
  // Store first and last points
  var first = coords.shift();
  var last = coords.pop();
  var result;

  // Remove duplicate from remaining elements
  result = _.uniq( coords, function( point ) {
    return point[ 0 ] + ':' + point[ 1 ];
  });

  // Attach first and last point back in place and assign new coords
  result.unshift( first );
  result.push( last );

  return result;
}

// Constructor method
function BudaGeoJSONAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda GeoJSON Agent ver. ' + info.version );

  // Configure schema and model for storage
  /* eslint no-reserved-keys:0 */
  StorageSchema = new mongoose.Schema({
    data:    { type: mongoose.Schema.Types.Mixed, default: {} },
    geojson: { type: mongoose.Schema.Types.Mixed, index: '2dsphere' }
  });
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', self.config.storage.collection );
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Connect to DB
  // The storage host will be collected from ENV and override as config parameter
  if( process.env.STORAGE_PORT ) {
    storage = process.env.STORAGE_PORT.replace( 'tcp://', '' );
  }
  if( self.config.storage.host ) {
    storage = self.config.storage.host;
  }

  // No storage located? exit with error
  if( ! storage ) {
    throw new Error( 'No storage available' );
  }

  // Append selected DB and connect
  storage += '/' + self.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );

  // Configure data parser
  self.parser = JSONStream.parse( self.config.options.pointer );

  // Parser errors
  self.parser.on( 'error', function( err ) {
    throw err;
  });

  // Rewind on complete
  self.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          throw err;
        }
      });
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  self.parser.on( 'data', function( obj ) {
    var i;
    var coords = obj.geometry.coordinates;

    // Remove altitude if required
    if( self.config.options.removeAltitude ) {
      removeAltitude( coords );
    }

    // Remove duplicate points
    if( self.config.options.removeDuplicatePoints ) {
      for( i = 0; i < obj.geometry.coordinates[ 0 ].length; i ++ ) {
        obj.geometry.coordinates[ 0 ] = removeDups( obj.geometry.coordinates[ 0 ] );
      }
    }

    // Final feature validation, only valid GeoJSON features will be stored
    GJV.isFeature( obj, function( valid ) {
      var item;

      if( valid ) {
        item = {
          geojson: obj.geometry,
          data:    {}
        };
        if( obj.properties ) {
          item.data.fromOrigin = obj.properties;
        }
        bag.push( item );
        if( bag.length === ( self.config.storage.batch || 20 ) ) {
          Doc.collection.insert( bag, function( err ) {
            if( err ) {
              throw err;
            }
          });
          bag = [];
        }
      } else {
        self.log( 'Invalid GeoJSON feature' );
      }
    });
  });
}
util.inherits( BudaGeoJSONAgent, BudaAgent );

// Disconnect from database on cleanup
BudaGeoJSONAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

module.exports = BudaGeoJSONAgent;
