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
/* eslint no-reserved-keys:0 */
var StorageSchema = new mongoose.Schema({
  data:    { type: mongoose.Schema.Types.Mixed, default: {} },
  geojson: { type: mongoose.Schema.Types.Mixed, index: '2dsphere' }
});

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
  var Doc;
  var self = this;
  var storage = '';
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda GeoJSON Agent ver. ' + info.version );

  // Configure schema and model for storage
  StorageSchema.set( 'collection', this.config.storage.collection );
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Connect to DB
  // If we're running inside a container some ENV variables should be
  // set, otherwise assume is a local run and fallback to localhost storage
  if( process.env.STORAGE_PORT ) {
    storage += process.env.STORAGE_PORT.replace( 'tcp://', '' );
  } else {
    storage += 'localhost:27017';
  }
  storage += '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );

  // Configure data parser
  this.parser = JSONStream.parse( this.config.data.pointer );

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          self.log( 'Storage error', 'error', err );
        }
      });
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  this.parser.on( 'data', function( obj ) {
    var i;
    var coords = obj.geometry.coordinates;

    // Remove altitude if required
    if( self.config.data.removeAltitude ) {
      removeAltitude( coords );
    }

    // Remove duplicate points
    if( self.config.data.removeDuplicatePoints ) {
      for( i = 0; i < obj.geometry.coordinates[ 0 ].length; i ++ ) {
        obj.geometry.coordinates[ 0 ] = removeDups( obj.geometry.coordinates[ 0 ] );
      }
    }

    // Final feature validation, only valid features will be stored
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
        if( bag.length === 20 ) {
          Doc.collection.insert( bag, function( err ) {
            if( err ) {
              self.log( 'Storage error', 'error', err );
            }
          });
          bag = [];
        }
      } else {
        self.log( 'Invalid GeoJSON feature', 'error', obj );
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
