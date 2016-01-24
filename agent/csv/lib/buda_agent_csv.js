// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var info = require( '../package' );
var CSV = require( 'csv-stream' );

// Constructor method
function BudaCSVAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda CSV Agent ver. ' + info.version );

  // Configure data parser
  this.parser = CSV.createStream( this.config.options || {});

  // Errors
  this.parser.on( 'error', function( err ) {
    self.emit( 'error', err );
  });

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.emit( 'record', bag );
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  this.parser.on( 'data', function( item ) {
    bag.push( self.transform( item ) );
    if( bag.length === ( self.config.storage.batch || 50 ) ) {
      self.emit( 'record', bag );
      bag = [];
    }
  });
}
util.inherits( BudaCSVAgent, BudaAgent );

module.exports = BudaCSVAgent;
