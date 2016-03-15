// Buda Agent Line
// ===============
// Base implementation for agents processing data line-by-line,
// custom implementations need only define the proper 'transform' method.
//
// function CustomLineAgent( conf ) {
//   BudaAgent.call( this, conf );
// }
// util.inherits( CustomLineAgent, BudaLineAgent );
//
// CustomLineAgent.prototype.transform = function( line ) {
//   /* Custom processing code here */
// };

// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( './buda_agent' );

// Custom requirements
var net = require( 'net' );
var util = require( 'util' );
var uuid = require( 'node-uuid' );
var async = require( 'async' );
var zlib = require( 'zlib' );
var byline = require( 'byline' );

// Constructor method
function BudaLineAgent( conf, handlers ) {
  BudaAgent.call( this, conf, handlers );
}
util.inherits( BudaLineAgent, BudaAgent );

// Empty tranform method, should be replaced on custom implementations
BudaLineAgent.prototype.transform = function( line ) {
  return { line: line };
};

// Custom start method
// This is required because of the way the flow is initiated
BudaLineAgent.prototype.start = function() {
  var self = this;
  var bag = [];
  var rec = false;
  var finalPass = false;
  var decompressor;

  // Connect to data storage using the parent implementation
  BudaLineAgent.super_.prototype.connectStorage.apply( this );

  // Store records
  self.on( 'batch', function( data ) {
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
      finalPass = null;
    }, BudaAgent.UPDATE_PASS_LENGTH );

    // Store bag of records
    self.model.collection.insert( data, function( err ) {
      if( err ) {
        self.emit( 'error', err );
      }
    });
  });

  // Create server
  this.incoming = net.createServer( function( socket ) {
    async.waterfall( [
      // Cleanup data if required
      function( next ) {
        if( self.config.update === 'replace' ) {
          self.logger.info( 'Cleanup' );
          self.model.collection.remove({}, function() {
            next( null );
          });
        } else {
          next( null );
        }
      },
      // Setup client
      function( next ) {
        // Attach client ID
        socket.id = uuid.v4();

        if( self.config.compression !== 'none' ) {
          // Create decompressor
          switch( self.config.compression ) {
            default:
            case 'gzip':
              decompressor = zlib.createGunzip();
              break;
          }

          self.parser = byline( socket.pipe( decompressor ), {
            end: false
          });
        } else {
          self.parser = byline( socket, {
            end: false
          });
        }

        // Notify client closed
        socket.on( 'close', function() {
          self.emit( 'client:close', this );
        });

        // Notify client connection
        self.emit( 'client:open', socket );
        next( null );
      },
      // Custom parser setup
      function( next ) {
        // Parser errors
        self.parser.on( 'error', function( err ) {
          self.emit( 'error', err );
        });

        // Complete
        self.parser.on( 'end', function() {
          if( bag.length > 0 ) {
            self.emit( 'batch', bag );
            bag = [];
          }
        });

        // Process data
        self.parser.on( 'data', function( line ) {
          rec = self.transform( line.toString() );
          if( rec ) {
            bag.push( rec );
          }
          if( bag.length === self.config.storage.batch ) {
            self.emit( 'batch', bag );
            bag = [];
          }
        });

        next( null );
      }
    ], function( err ) {
      if( err ) {
        self.emit( 'error', err );
      }
    });
  });

  // Start listening for data
  this.incoming.listen( this.endpoint, function() {
    self.emit( 'ready' );
  });
};

module.exports = BudaLineAgent;
