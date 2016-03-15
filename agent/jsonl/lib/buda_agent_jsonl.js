// Enable strict syntax mode
'use strict';

// Base class
var BudaLineAgent = require( '../../buda_agent_line' );

// Custom requirements
var util = require( 'util' );

// Constructor method
function BudaJSONLAgent( conf, handlers ) {
  BudaLineAgent.call( this, conf, handlers );
}
util.inherits( BudaJSONLAgent, BudaLineAgent );

// Parse each line as a JSON object
BudaJSONLAgent.prototype.transform = function( line ) {
  var res;

  try {
    res = JSON.parse( line );
    return res;
  } catch( e ) {
    this.emit( 'error', line );
    return false;
  }
};

module.exports = BudaJSONLAgent;
