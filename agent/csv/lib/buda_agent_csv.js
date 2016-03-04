// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var CSV = require( 'csv-stream' );

// Constructor method
function BudaCSVAgent( conf, handlers ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf, handlers );

  // Configure data parser
  this.parser = CSV.createStream( this.config.options || {});

  // Errors
  this.parser.on( 'error', function( err ) {
    self.emit( 'error', err );
  });

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.emit( 'batch', bag );
      bag = [];
    }
  });

  // Process records
  this.parser.on( 'data', function( item ) {
    bag.push( self.transform( item ) );
    if( bag.length === self.config.storage.batch ) {
      self.emit( 'batch', bag );
      bag = [];
    }
  });
}
util.inherits( BudaCSVAgent, BudaAgent );

module.exports = BudaCSVAgent;
