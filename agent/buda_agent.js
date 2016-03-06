// Buda Agent
// ==========
// Base template of a buda agent; should be extended on specific implementations.
//
// Events emitted:
// - error
// - exit
// - ready
// - batch
// - flow:start
// - flow:end
//
// Extend:
// function CustomAgent( conf ) {
//   BudaAgent.call( this, conf );
//
//   this.parser = .....
// }
// util.inherits( CustomAgent, BudaAgent );

// Enable strict syntax mode
'use strict';

// Load required modules
var _ = require( 'underscore' );
var net = require( 'net' );
var util = require( 'util' );
var zlib = require( 'zlib' );
var bunyan = require( 'bunyan' );
var mongoose = require( 'mongoose' );
var events = require( 'events' );

// Constructor
// Configuration parameters expected should match the 'dataset.data' attribute
// according to the supported dataset schema version
function BudaAgent( conf, handlers ) {
  // Process each data packet received
  this.parser = null;

  // Readable stream opened against the agent's endpoint
  this.incoming = null;

  // Store configuration options
  this.config = conf;

  // Internal agent state
  this.currentState = {
    creationDate:   new Date(),
    lastUpdate:     null,
    batchCounter:   0,
    recordsCounter: 0
  };

  // Location to listen for incoming data packets
  this.endpoint = conf.hotspot.location;

  // Logging interface
  this.logger = bunyan.createLogger({
    name:   conf.storage.collection,
    stream: process.stdout,
    level:  'debug'
  });

  // Attach event handlers if provided
  if( handlers && _.isObject( handlers ) ) {
    this.attachHandlers( handlers );
  }

  // Configure schema and base data model for storage
  this.storageSchema = new mongoose.Schema({});
  this.storageSchema.set( 'strict', false );
  this.storageSchema.set( 'collection', this.config.storage.collection );
  this.model = mongoose.model( 'Doc', this.storageSchema );

  // Listen for interruptions
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( this.exit, this ) );
  process.on( 'SIGTERM', _.bind( this.exit, this ) );
}

// Add event emitter capabilities
util.inherits( BudaAgent, events.EventEmitter );

// This is the maximum time in ms that can elapse between batches storage
// before it counts as a new update entirely; this may be adjusted to account
// for network latency
BudaAgent.UPDATE_PASS_LENGTH = 2000;

// Start listening for data on the endpoint
// For tests you can run:
// cat datafile | nc localhost PORT
// cat datafile | nc -U file.sock
BudaAgent.prototype.start = function() {
  var self = this;
  var finalPass = false;
  var decompressor;

  // Check a valid parser is set
  if( ! this.parser ) {
    this.emit( 'error', new Error( 'No parser set for the agent' ) );
  }

  // Connect to data storage
  this.connectStorage();

  // Store records setup
  // Since we're using "end:false" as piping option some parsers don't emit
  // the 'end' event; using a timer we manually emit the event once per data upload
  self.on( 'batch', function( bag ) {
    // Increase counters
    self.currentState.batchCounter += 1;
    self.currentState.recordsCounter += bag.length;

    // Clear previous timer if any
    if( finalPass ) {
      clearTimeout( finalPass );
    } else {
      self.emit( 'flow:start', self.currentState );
    }

    // Setup final pass timer
    finalPass = setTimeout( function() {
      self.currentState.lastUpdate = new Date();
      self.parser.emit( 'end' );
      self.emit( 'flow:end', self.currentState );
      clearTimeout( finalPass );
    }, BudaAgent.UPDATE_PASS_LENGTH );

    // Store bag of records
    self.model.collection.insert( bag, function( err ) {
      if( err ) {
        throw err;
      }
    });
  });

  // Create server
  self.incoming = net.createServer( function( socket ) {
    if( self.config.compression !== 'none' ) {
      // Create decompressor
      switch( self.config.compression ) {
        default:
        case 'gzip':
          decompressor = zlib.createGunzip();
          break;
      }

      socket
        .pipe( decompressor, { end: false })
        .pipe( self.parser, { end: false });
    } else {
      socket.pipe( self.parser, { end: false });
    }
  });

  // Start listening for data
  self.incoming.listen( self.endpoint, function() {
    self.emit( 'ready' );
  });
};

// Gracefull shutdown process
BudaAgent.prototype.exit = function() {
  // Close incoming connections
  if( this.incoming ) {
    this.incoming.close();
  }

  // Close DB connection
  mongoose.disconnect();

  // Custom cleanup process
  this.cleanup();

  // Exit
  this.emit( 'exit' );
};

// Cleanup
BudaAgent.prototype.cleanup = function() {
  return;
};

// Data transform
BudaAgent.prototype.transform = function( record ) {
  return record;
};

// Utility method to attach a set of event handlers at once
BudaAgent.prototype.attachHandlers = function( handlers ) {
  var self = this;

  _.each( handlers, function( v, k ) {
    // Just attach valid functions
    if( _.isFunction( v ) ) {
      self.on( k, v );
    }
  });
};

// Stablish a connection with the used data storage
BudaAgent.prototype.connectStorage = function() {
  var storage = this.config.storage.host;

  // No storage located? exit with error
  if( ! storage ) {
    this.emit( 'error', new Error( 'No storage available' ) );
  }

  // Append selected DB if required and connect
  mongoose.connect( 'mongodb://' + storage );
  return;
};

module.exports = BudaAgent;
