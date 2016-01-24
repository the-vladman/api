// Buda Agent
// ==========
// Base template of a buda agent; should be extended on
// specific implementations.
//
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
var mongoose = require( 'mongoose' );
var events = require( 'events' );

// Constructor
// Configuration parameters expected should match the 'dataset.data' attribute
// according to the supported dataset schema version
function BudaAgent( conf ) {
  // Process each data packet received
  this.parser = null;

  // Readable stream opened against the agent's endpoint
  this.incoming = null;

  // Location to listen for incoming data packets
  this.endpoint = conf.hotspot.location;

  // Configuration parameters
  this.config = conf;
  if( ! _.has( this.config, 'compression' ) ) {
    this.config.compression = 'none';
  }

  // Add a data decompressor if required
  switch( this.config.compression ) {
    case 'gzip':
      this.decrompressor = zlib.createGunzip();
      break;
    case 'none':
    default:
      this.config.compression = 'none';
      this.decrompressor = null;
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

// Start listening for data on the endpoint
// For tests you can run:
// cat datafile | nc localhost PORT
// cat datafile | nc -U file.sock
BudaAgent.prototype.start = function() {
  var self = this;
  var finalPass = false;

  // Check a valid parser is set
  if( ! this.parser ) {
    throw new Error( 'No parser set for the agent' );
  }

  // Connect to data storage
  this.connectStorage();

  // Store records setup
  // Since we're using "end:false" as piping option some parsers
  // don't emit the 'end' event and some entries are not being stored;
  // using a timer we manually emit the event once per data upload
  self.on( 'record', function( bag ) {
    // Clear previous timer if any
    if( finalPass ) {
      clearTimeout( finalPass );
    }

    // Setup final pass timer
    finalPass = setTimeout( function() {
      self.parser.emit( 'end' );
      clearTimeout( finalPass );
    }, 2000 );

    // Store bag of records
    self.model.collection.insert( bag, function( err ) {
      if( err ) {
        throw err;
      }
    });
  });

  // Handle errors
  self.on( 'error', function( err ) {
    throw err;
  });

  // Create server
  self.incoming = net.createServer( function( socket ) {
    if( self.config.compression !== 'none' ) {
      socket
        .pipe( self.decrompressor, { end: false })
        .pipe( self.parser, { end: false });
    } else {
      socket.pipe( self.parser, { end: false });
    }
  });

  // Start listening for data
  self.incoming.listen( self.endpoint, function() {
    self.log( 'Agent ready' );
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

  // Exit entirely
  /* eslint no-process-exit:0 */
  process.exit();
};

// Cleanup procedure
// Just logging message by default, could be implemented based on
// the custom agent specific requirements
BudaAgent.prototype.cleanup = function() {
  return;
};

// Data transform procedure
// Just logging message by default, could be implemented based on
// the custom agent specific requirements
BudaAgent.prototype.transform = function( record ) {
  return record;
};

// Stablish a connection with the used data storage
BudaAgent.prototype.connectStorage = function() {
  var storage = this.config.storage.host;

  // No storage located? exit with error
  if( ! storage ) {
    throw new Error( 'No storage available' );
  }

  // Append selected DB if required and connect
  mongoose.connect( 'mongodb://' + storage );
  return;
};

// Logs are sent directly to stdout as JSON message; if a string is used
// as parameter a minimal wrap object is used for it, time is automatically
// added to all messages
/* eslint no-param-reassign:0 */
BudaAgent.prototype.log = function( msg ) {
  if( _.isObject( msg ) ) {
    msg = JSON.stringify( msg );
  }
  process.stdout.write( msg );
};

module.exports = BudaAgent;
