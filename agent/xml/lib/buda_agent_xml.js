// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent  = require( '../../buda_agent' );

// Custom requirements
var _          = require( 'underscore' );
var util       = require( 'util' );
var net        = require( 'net' );
var mongoose   = require( 'mongoose' );
var info       = require( '../package' );
var xmlflow    = require( 'xml-flow' );

// Storage schema basic definiton
var StorageSchema = mongoose.Schema({});

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
  var storage = '';
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

// Custom start method
// This is required because of the way the flow is initiated
BudaXMLAgent.prototype.start = function() {
  // Determine agent endpoint to use
  if( this.config.hotspot.type === 'unix' ) {
    this.endpoint = this.config.id + '.sock';
  } else {
    this.endpoint = this.config.hotspot.location;
  }
  
  // Self pointer
  var self = this;
  
  // Storage model
  var Doc = mongoose.model( 'Doc', StorageSchema );
  
  // Create server
  this.incoming = net.createServer( _.bind( function( socket ) {
    
    // Configure xml flow
    self.parser = xmlflow( socket, {
      normalize: self.config.data.normalize,
      trim: self.config.data.trim,
      lowercase: self.config.data.lowercase
    });
    
    // Rewind on complete
    self.parser.on( 'end', function() {
      self.log( 'Processing done!' );
    });
    
    // Process records
    var bag = [];
    self.parser.on( 'tag:' + self.config.data.pointer, function( item ) {
      bag.push( item.$attrs );
      if( bag.length == 25 ) {
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