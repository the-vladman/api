// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var _ = require( 'underscore' );
var util = require( 'util' );
var net = require( 'net' );
var mongoose = require( 'mongoose' );
var info = require( '../package' );
var xmlflow = require( 'xml-flow' );

// Storage schema basic definiton
var StorageSchema = new mongoose.Schema({});
var storage = '';

// Constructor method
function BudaXMLAgent( conf ) {
  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda XML Agent ver. ' + info.version );

  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', this.config.storage.collection );

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
}
util.inherits( BudaXMLAgent, BudaAgent );

// Disconnect from database on cleanup
BudaXMLAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

// Perform cleanup on items before storage
BudaXMLAgent.prototype.cleanItem = function( item ) {
  var self = this;

  _.each( item, function( v, k, obj ) {
    // Remove processing markers
    if( k.substr( 0, 1 ) === '$' ) {
      delete obj[ k ];
    }

    // Properly handle arrays
    if( k === '0' ) {
      // self.log( _.values( obj ) );
    }

    // Iterate recursively on nested objects
    if( _.isObject( v ) ) {
      self.cleanItem( v );
    }
  });

  return item;
};

// Custom start method
// This is required because of the way the flow is initiated
BudaXMLAgent.prototype.start = function() {
  var self = this;
  var Doc;
  var bag = [];

  // Determine agent endpoint to use
  if( this.config.hotspot.type === 'unix' ) {
    this.endpoint = this.config.id + '.sock';
  } else {
    this.endpoint = this.config.hotspot.location;
  }

  // Storage model
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Create server
  this.incoming = net.createServer( _.bind( function( socket ) {
    // Configure xml flow
    self.parser = xmlflow( socket, {
      normalize: self.config.data.normalize,
      trim:      self.config.data.trim,
      lowercase: self.config.data.lowercase,
      useArrays: xmlflow.ALWAYS
    });

    // Rewind on complete
    self.parser.on( 'end', function() {
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
    self.parser.on( 'tag:' + self.config.data.pointer, function( item ) {
      // Cleanup items
      self.cleanItem( item );
      bag.push( item );
      if( bag.length === 50 ) {
        Doc.collection.insert( bag, function( err ) {
          if( err ) {
            self.log( 'Storage error', 'error', err );
          }
        });
        bag = [];
      }
    });
  }, this ) );

  // Start listening for data
  this.incoming.listen( this.endpoint, _.bind( function() {
    this.log( 'Agent ready' );
  }, this ) );
};

module.exports = BudaXMLAgent;
