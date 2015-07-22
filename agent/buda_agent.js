/* eslint no-process-exit:0 */
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
var events = require( 'events' );

// Constructor
function BudaAgent( conf ) {
  this.parser = null;
  this.endpoint = null;
  this.incoming = null;
  this.config = conf;

  // Listen for interruptions
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( function() {
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
    // Prevent parser from exiting ond 'end' events
    socket.pipe( this.parser, {
      end: false
    });
  }, this ) );

  // Start listening for data
  this.incoming.listen( this.endpoint, _.bind( function() {
    this.log( 'Agent ready' );
  }, this ) );
};

// Cleanup procedure
// Just logging message by default, could be implemented based on
// the custom agent specific requirements
BudaAgent.prototype.cleanup = function() {
  this.log( 'Closing agent' );
  return;
};

// Log information
BudaAgent.prototype.log = function( desc, level, details ) {
  var msg = {
    desc:  desc,
    level: level || 'info'
  };

  if( details ) {
    msg.details = details;
  }

  process.stdout.write( JSON.stringify( msg ) );
};

module.exports = BudaAgent;
