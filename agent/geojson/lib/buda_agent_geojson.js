// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent  = require( '../../buda_agent' );

// Custom requirements
var _          = require( 'underscore' );
var util       = require( 'util' );
var mongoose   = require( 'mongoose' );
var JSONStream = require( 'JSONStream' );
var GJV        = require( 'geojson-validation' );
var info       = require( '../package' );

// Private utility method
// Coords should be stored as long,lat; no altitude element included
function removeAltitude( coords ) {
  _.each( coords, function( item ) {
    if( _.isArray( item ) ) {
      // Recursive call for nested arrays at any depth
      removeAltitude( item );
    } else {
      // If the coords data has three elements,
      // remove the last one ( altitude )
      if( coords.length === 3 ) {
        coords.pop();
      }
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

  // Remove duplicate from remaining elements
  coords = _.uniq( coords, function( point ) {
    return point[0] + ':' + point[1];
  });

  // Attach first and last point back in place and assign new coords
  coords.unshift( first );
  coords.push( last );

  return coords;
}

// Storage schema basic definiton
var StorageSchema = mongoose.Schema({
  data    : { type: mongoose.Schema.Types.Mixed, default:{} },
  geojson : { type: mongoose.Schema.Types.Mixed, index: '2dsphere' }
});

// Constructor method
function BudaGeoJSONAgent( conf ) {
  BudaAgent.call( this, conf );
  
  // Log agent information
  this.log( 'Buda GeoJSON Agent ver. ' + info.version );
  
  // Configure schema and model for storage
  StorageSchema.set( 'collection', this.config.storage.collection );
  var Doc = mongoose.model( 'Doc', StorageSchema );
  
  // Connect to DB
  var storage = this.config.storage.host + '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );
  
  // Configure data parser
  this.parser = JSONStream.parse( this.config.data.pointer );
  
  // Self pointer
  var self = this;
  
  // Rewind on complete
  this.parser.on( 'end', function() {
    self.log( 'Processing done!' );
  });
  
  // Process each record
  this.parser.on( 'data', function( obj ) {
    var coords = obj.geometry.coordinates;
    
    // Remove altitude if required
    if( self.config.data.removeAltitude ) {
      removeAltitude( coords );
    }
    
    // Remove duplicate points
    if( self.config.data.removeDuplicatePoints ) {
      for( var i = 0; i < obj.geometry.coordinates[0].length; i++ ) {
        obj.geometry.coordinates[0] = removeDups( obj.geometry.coordinates[0] );
      }
    }
    
    // Final feature validation, only valid features will be stored
    GJV.isFeature( obj, function( valid ) {
      if( valid ) {
        // Create record
        var record = new Doc({ geojson: obj.geometry });
        if( obj.properties ) {
          record.data.fromOrigin = obj.properties;
        }
        
        // Store record
        record.save( function( err ) {
          if( err ) {
            self.emit( 'error' );
          }
        });
        
        self.emit( 'hit' );
      } else {
        self.emit( 'error' );
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