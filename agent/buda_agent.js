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
var _        = require( 'underscore' );
var net      = require( 'net' );
var util     = require( 'util' );
var events   = require( 'events' );

// Constructor
function BudaAgent( conf ) {
  this.parser   = null;
  this.endpoint = null;
  this.incoming = null;
  this.config   = conf;
  
  // Listen for interruptions
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( function() {
    this.log( 'Closing agent' );
    if( this.incoming ) {
      this.incoming.close();
    }
    this.cleanup();
    process.exit();
  }, this ) );
}

// Add event emitter capabilities
util.inherits( BudaAgent, events.EventEmitter );

// Start listening for data on the endpoint
// nc localhost PORT
// nc -U file.sock
BudaAgent.prototype.start = function() {
  // Determine agent endpoint to use
  if( this.config.hotspot.type === 'unix' ) {
    this.endpoint = this.config.id + '.sock';
  } else {
    this.endpoint = this.config.hotspot.location;
  }
  
  // Create server
  this.incoming = net.createServer( _.bind( function( socket ) {
    socket.pipe( this.parser );
  }, this ) );
  
  // Start listening for data
  this.incoming.listen( this.endpoint, _.bind( function() {
    this.log( 'Agent ready' );
  }, this ) );
};

// Cleanup procedure
// Empty by default, should be implementad based on the custom
// agent specific requirements
BudaAgent.prototype.cleanup = function() {
  return;
};

// Log information
BudaAgent.prototype.log = function( msg ) {
  process.stdout.write( process.pid + ': ' + msg );
};

module.exports = BudaAgent;