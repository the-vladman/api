// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var net = require( 'net' );
var uuid = require( 'node-uuid' );
var async = require( 'async' );
var zlib = require( 'zlib' );
var xmlflow = require( 'xml-flow' );

// Constructor method
function BudaXMLAgent( conf, handlers ) {
  BudaAgent.call( this, conf, handlers );
}
util.inherits( BudaXMLAgent, BudaAgent );

// Perform cleanup on items before storage
BudaXMLAgent.prototype.cleanItem = function( item ) {
  var string = JSON.stringify( item )
                   .replace( /\$attrs/g, '_attrs' )
                   .replace( /\$name/g, '_name' )
                   .replace( /\$text/g, '_text' );

  return JSON.parse( string );
};

// Custom start method
// This is required because of the way the flow is initiated
BudaXMLAgent.prototype.start = function() {
  var self = this;
  var bag = [];
  var finalPass = false;
  var decompressor;

  // Connect to data storage using the parent implementation
  BudaXMLAgent.super_.prototype.connectStorage.apply( this );

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
  self.incoming = net.createServer( function( socket ) {
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
          self.parser = xmlflow( socket.pipe( decompressor ), self.config.options );
        } else {
          self.parser = xmlflow( socket, self.config.options );
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

        // Rewind on complete
        self.parser.on( 'end', function() {
          if( bag.length > 0 ) {
            self.emit( 'batch', bag );
            bag = [];
          }
        });

        // Process records
        self.parser.on( 'tag:' + self.config.options.pointer, function( item ) {
          // Cleanup items
          bag.push( self.transform( self.cleanItem( item ) ) );
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

module.exports = BudaXMLAgent;
