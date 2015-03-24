// Buda Manager
// ============
// Handle a graph of subprocesses for data manipulation on
// specific zones and provides a REST interface for management.
//
// Available commands:
//    getZoneList        GET /
//    getZoneDetails     GET /{id}
//    updateZone         PUT /{id}
//    updateZone         PATCH /{id}
//    deleteZone         DELETE /{id}
//    registerZone       POST /
//    ping               GET /ping

// Enable strict syntax mode
'use strict';

// Load required modules
var _        = require( 'underscore' );
var fs       = require( 'fs' );
var util     = require( 'util' );
var Hapi     = require( 'hapi' );
var crypto   = require( 'crypto' );
var spawn    = require( 'child_process' ).spawn;
var colors   = require( 'colors/safe' );
var info     = require( '../package' );

// Utility method to output style-rich and uniform messages
function log( msg, bold, color ) {
  var style = color || 'white';
  if( bold ) {
    process.stdout.write( colors[style].bold( '===> ' + msg ) );
  } else {
    process.stdout.write( colors[style]( '     ' + msg ) );
  }
  process.stdout.write( '\n' );
}

// Utility method to calculate a zone ID
function getID( zone ) {
  var shasum = crypto.createHash( 'sha1' );
  var digest = '|';
  digest += zone.version + '|';
  digest += zone.metadata.name + '|';
  digest += zone.metadata.description + '|';
  digest += zone.metadata.organization + '|';
  digest += zone.data.type + '|';
  digest += zone.storage.type + '|';
  digest += zone.hotspot.type + '|';
  
  shasum.update( digest );
  return shasum.digest( 'hex' );
}

// Constructor method
function BudaManager( config ) {
  // Runtime zones list
  this.zones = [];
  
  // Runtime agents list
  this.agents = [];
  
  // Runtime configuration holder
  this.config = _.defaults( config, BudaManager.DEFAULTS );
  
  // API interface
  this.restapi = new Hapi.Server({
    minimal: true,
    load: { 
      sampleInterval: 5000
    }
  });
}

// Default config values
// - The 'home' directory must be readable and writable by the user
//   starting the daemon.
// - Only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advaised ( or required )
BudaManager.DEFAULTS = {
  home: '/home/buda/',
  port: 8000,
  list: 'zones.conf'
};

// Apply verifications to the home/working directory
BudaManager.prototype._verifyHome = function() {
  log( 'Check home directory exist' );
  if( ! fs.existsSync( this.config.home ) ) {
    log( 'Home directory does not exist', true, 'red' );
    process.exit();
  }
  
  log( 'Check home directory is readable and writeable' );
  try {
    fs.accessSync( this.config.home, fs.R_OK | fs.W_OK );
  } catch( err ) {
    log( 'Home directory is not accesable by the process', true, 'red' );
    process.exit();
  }
};

// Setup REST interface
BudaManager.prototype._startInterface = function() {
  // Config connection socket
  this.restapi.connection({
    host: 'localhost', 
    port: this.config.port
  });
  
  // Attach REST routes to commands
  var self = this;
  this.restapi.route([
    {
      method: 'GET',
      path:'/ping', 
      handler: function( request, reply ) {
        request.log();
        log( 'Health check', true, 'gray' );
        reply( 'pong' );
      }
    },
    {
      method: 'GET',
      path:'/', 
      handler: function( request, reply ) {
        request.log();
        reply( self._getZoneList() );
      }
    },
    {
      method: 'GET',
      path:'/{id}', 
      handler: function( request, reply ) {
        request.log();
        reply( self._getZoneDetails( request.params.id ) );
      }
    },
    {
      method: 'PUT',
      path:'/{id}', 
      handler: function( request, reply ) {
        request.log();
        reply( self._updateZone( request.params.id, request.payload.zone ) );
      }
    },
    {
      method: 'PATCH',
      path:'/{id}', 
      handler: function( request, reply ) {
        request.log();
        reply( self._updateZone( request.params.id, request.payload.zone ) );
      }
    },
    {
      method: 'DELETE',
      path:'/{id}', 
      handler: function( request, reply ) {
        request.log();
        reply( self._deleteZone( request.params.id ) );
      }
    },
    {
      method: 'POST',
      path:'/', 
      handler: function( request, reply ) {
        request.log();
        reply( self._registerZone( request.payload.zone ) );
      }
    },
    {
      method: '*',
      path:'/{p*}', 
      handler: function( request, reply ) {
        request.log();
        log( 'Invalid request', true, 'red' );
        reply( { error: true, desc: 'INVALID_REQUEST' } );
      }
    }
  ]);
  
  // Open connections
  this.restapi.on( 'request', function( req ) {
    log( req.method.toUpperCase() + ' - ' + req.path, true, 'yellow' );
  });
  this.restapi.start();
};

// Starts a new zone agent
BudaManager.prototype._startAgent = function( zone ) {
  // Setup
  var bin  = 'buda-agent-' + zone.data.type;
  var conf = {};
  conf.id      = zone.id;
  conf.data    = zone.data.options;
  conf.storage = zone.storage.options;
  conf.hotspot = zone.hotspot;
  
  // Create agent
  var agent = spawn( bin, ['--conf', JSON.stringify( conf ) ] );
  
  // Log agent standard output too
  agent.stdout.on( 'data', function( data ) {
    log( util.format('%s', data ), false, 'magenta' );
  });
  
  // If the agent die; remove it from the list
  agent.on( 'exit', _.bind( function() {
    log( 'Removing agent: ' + agent.pid, true );
    this.agents.splice( _.indexOf( this.agents, agent ), 1 );
  }, this ) );
  
  // Add agent and attach process PID to the zone
  this.agents.push( agent );
  zone.agentPID = agent.pid;
};

// Retrive a list of all zones in play
BudaManager.prototype._getZoneList = function() {
  log( 'Retrieving zones list', true );
  log( 'List retrieved', true, 'green' );
  return this.zones;
};

// Retrieve details of a specific zone
BudaManager.prototype._getZoneDetails = function( id ) {
  log( 'Retrieving details for zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  log( 'Validating zone id', false, 'gray' );
  var zone = _.findWhere( this.zones, { id: id });
  if( ! zone ) {
    log( 'Invalid zone ID: ' + id, true, 'red' );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  
  log( 'Details retrieved', true, 'green' );
  return zone;
};

// Update and existing zone
BudaManager.prototype._updateZone = function( id, newData ) {
  log( 'Updating zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  log( 'Validating zone id', false, 'gray' );
  var zone = _.findWhere( this.zones, { id: id });
  if( ! zone ) {
    log( 'Invalid zone ID: ' + id, true, 'red' );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  
  // Stop zone agent
  log( 'Stopping zone agent', false, 'gray' );
  process.kill( zone.agentPID, 'SIGINT' );
  this.zones.splice( _.indexOf( this.zones, zone ), 1 );
  
  // Create zone with newData
  return this._registerZone( newData );
};

// Delete a running zone
BudaManager.prototype._deleteZone = function( id ) {
  log( 'Deleting zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  var zone = _.findWhere( this.zones, { id: id });
  if( ! zone ) {
    log( 'Invalid zone ID: ' + id, true, 'red' );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  
  // Stop zone agent
  log( 'Stopping zone agent', false, 'gray' );
  process.kill( zone.agentPID, 'SIGINT' );
  
  // Remove
  log( 'Removing zone', false, 'gray' );
  this.zones.splice( _.indexOf( this.zones, zone ), 1 );
  
  log( 'Zone deleted', true, 'green' );
  return zone;
};

// Register a new zone
BudaManager.prototype._registerZone = function( zone ) {
  log( 'Registering new zone', true );
  
  // Validate zone details
  log( 'Validating zone details', false, 'gray' );
  
  // Calculate ID
  zone.id = getID( zone );
  log( 'New zone ID: ' + zone.id, false, 'gray' );
  
  // Spawn agent based on zone.data.type
  this._startAgent( zone );
  log( 'New zone agent: ' + zone.agentPID, false, 'gray' );
  
  // Add zone to the list
  this.zones.push( zone );
  log( 'Attach new zone', false, 'gray' );
  
  log( 'Zone created', true, 'green' );
  return zone;
};

// Gracefully shutdown
BudaManager.prototype._cleanUp = function() {
  log( 'Graceful shutdown', true, 'red' );
  
  // Stop running agents
  log( 'Stopping running agents', false, 'red' );
  _.each( this.agents, function( agent ) {
    process.kill( agent.pid, 'SIGINT' );
  });
  
  // Exit main process;
  // Give 350ms to each agent to gracefully close too
  setTimeout( function() {
    log( 'Exiting Manager', true, 'red' );
    process.exit();
  }, this.agents.length * 350 );
};

// Show usage information
BudaManager.prototype.printHelp = function() {
  log( 'Usage information', true, 'gray' );
  log( 'Available configuration options are:', false, 'gray' );
  _.each( BudaManager.DEFAULTS, function( val, key ) {
    log( key + '\t' + val, false, 'gray' );
  });
};

// Kickstart for the daemon process
BudaManager.prototype.start = function() {
  log( 'Buda Manager ver. ' + info.version, true, 'green' );
  
  // Looking for help ?
  if( _.has( this.config, 'h' ) || _.has( this.config, 'help' ) ) {
    this.printHelp();
    process.exit();
  }
  
  // Log config
  log( 'Starting with PID: ' + process.pid, true );
  log( 'Parameters', true );
  _.each( this.config, function( val, key ) {
    log( key + ': ' + val, false, 'gray' );
  });
  
  // Home directory validations
  log( 'Verifying working directory', true );
  this._verifyHome();
  
  // Move process to working directory
  log( 'Moving process to working directory', true );
  process.chdir( this.config.home );
  
  // Start REST interface
  log( 'Starting REST interface', true );
  this._startInterface();
  
  // Log final output
  _.each( this.restapi.info, function( val, key ) {
    log( key + ': ' + val, false, 'gray' );
  });
  log( 'Initialization process complete', true );
  
  // Listen for interruptions and gracefully shutdown
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( function() {
    this._cleanUp();
  }, this ));
};

module.exports = BudaManager;