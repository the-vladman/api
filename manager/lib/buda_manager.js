/* eslint no-sync:0, no-process-exit:0 */
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
var _ = require( 'underscore' );
var fs = require( 'fs' );
var path = require( 'path' );
var Hapi = require( 'hapi' );
var crypto = require( 'crypto' );
var spawn = require( 'child_process' ).spawn;
var execSync = require( 'child_process' ).execSync;
var info = require( '../package' );
var colors = require( 'colors/safe' );
var bunyan = require( 'bunyan' );
var jsen = require( 'jsen' );
var YAML = require( 'yamljs' );

// Utility method to calculate a zone ID
function getID( zone ) {
  var shasum = crypto.createHash( 'sha1' );
  var digest = '|';

  digest += zone.version + '|';
  digest += zone.metadata.title + '|';
  digest += zone.metadata.description + '|';
  digest += zone.metadata.organization + '|';
  digest += zone.data.format + '|';
  digest += zone.data.storage.collection + '|';
  digest += zone.data.hotspot.type + '|';

  shasum.update( digest );
  return shasum.digest( 'hex' );
}

// Constructor method
function BudaManager( params ) {
  // Runtime zones list
  this.zones = [];

  // Runtime agents list
  this.agents = [];

  // Runtime configuration holder
  this.config = _.defaults( params, BudaManager.DEFAULTS );

  // JSON schemas used
  this.schemas = {};

  // App logging interface
  this.logger = bunyan.createLogger({
    name:   'buda-manager',
    stream: process.stdout,
    level:  'debug'
  });

  // API interface
  this.restapi = new Hapi.Server({
    minimal: true,
    load:    {
      sampleInterval: 5000
    }
  });
}

// Default config values
// - db: MongoDB instance used for data storage
// - home: This directory must be readable and writable by the user
//   starting the daemon.
// - port: Main TCP port used to wait for commands using the API,
//   only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advised ( nor required )
// - docker: If set, launch agents as docker containers instead of
//   child processes
// - range: Inclusive range of TCP ports to use for agents
BudaManager.DEFAULTS = {
  db:     'buda',
  home:   '/var/run/buda',
  port:   8100,
  docker: false,
  range:  '2810-2890'
};

// Apply verifications to the home/working directory
BudaManager.prototype._verifyHome = function() {
  this.logger.debug( 'Check home directory exist' );
  if( ! fs.existsSync( this.config.home ) ) {
    this.logger.fatal( 'Home directory does not exist' );
    process.exit();
  }

  this.logger.debug( 'Check home directory is readable and writeable' );
  try {
    fs.accessSync( this.config.home, fs.R_OK | fs.W_OK );
  } catch( err ) {
    this.logger.fatal( err, 'Invalid permissions' );
    process.exit();
  }
};

// Setup REST interface
BudaManager.prototype._startInterface = function() {
  var self = this;

  // Config connection socket
  this.restapi.connection({
    host: '0.0.0.0',
    port: this.config.port
  });

  // Attach REST routes to commands
  this.restapi.route( [
    {
      method:  'GET',
      path:    '/ping',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Healt check' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply( 'pong' );
      }
    },
    {
      method:  'GET',
      path:    '/',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Retrieve zone list' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply( self._getZoneList() );
      }
    },
    {
      method:  'GET',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Retrieve zone details' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply( self._getZoneDetails( request.params.id ) );
      }
    },
    {
      method:  'PUT',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Update zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        reply( self._updateZone( request.params.id, request.payload.zone ) );
      }
    },
    {
      method:  'PATCH',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Update zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        reply( self._updateZone( request.params.id, request.payload.zone ) );
      }
    },
    {
      method:  'DELETE',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Delete zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply( self._deleteZone( request.params.id ) );
      }
    },
    {
      method:  'POST',
      path:    '/',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Create zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        reply( self._registerZone( request.payload.zone ) );
      }
    },
    {
      method:  '*',
      path:    '/{p*}',
      handler: function( request, reply ) {
        self.logger.warn( 'Bad request: %s %s', request.method, request.path );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply({
          error: true,
          desc:  'INVALID_REQUEST'
        });
      }
    }
  ] );

  // Open connections
  this.restapi.start();
};

// Starts a new zone agent
/* eslint complexity:0 */
BudaManager.prototype._startAgent = function( zone ) {
  var self = this;
  var cmd;
  var seed;
  var agent;
  var portsRange;

  // Start agent as a container if running in 'docker' mode
  if( this.config.docker ) {
    // Set default port to the one exposed on the docker image; it will
    // be dynamically mapped on launch
    if( zone.data.hotspot.type === 'tcp' && ! zone.data.hotspot.location ) {
      zone.data.hotspot.location = 8200;
    }

    // Create docker launch command
    cmd = 'docker run -dP --name ' + zone.data.storage.collection + ' ';
    if( zone.extras.docker.links ) {
      _.each( zone.extras.docker.links, function( el ) {
        cmd += '--link ' + el + ' ';
      });
    }
    cmd += zone.extras.docker.image + ' ';
    cmd += "--conf '" + JSON.stringify( zone.data ) + "'";

    // Start container and use the hash returned as ID
    agent = execSync( cmd ).toString().substr( 0, 12 );
    this.logger.info( 'Starting container agent: %s', agent );
    this.logger.debug({
      configuration: zone.data,
      cmd:           cmd
    }, 'Starting container agent: %s', agent );

    this.agents.push( agent );
    zone.extras.agent = agent;
    return;
  }

  // Start agent as a sub-process
  // Randomly find a port in the provided range if required
  if( zone.data.hotspot.type === 'tcp' && ! zone.data.hotspot.location ) {
    portsRange = this.config.range.split( '-' );
    portsRange[ 0 ] = Number( portsRange[ 0 ] );
    portsRange[ 1 ] = Number( portsRange[ 1 ] );
    seed = Math.random() * ( portsRange[ 1 ] - portsRange[ 0 ] ) + portsRange[ 0 ];
    zone.data.hotspot.location = Math.floor( seed );
  }

  // Sub-process setup
  cmd = 'buda-agent-' + zone.data.format;
  if( zone.extras.handler ) {
    cmd = zone.extras.handler;
  }

  // Create agent
  agent = spawn( cmd, ['--conf', JSON.stringify( zone.data ) ] );
  self.logger.info( 'Starting agent: %s', agent.pid );
  self.logger.debug({
    configuration: zone.data,
    cmd:           cmd
  }, 'Starting agent: %s', agent.pid );

  // Add agent and attach process PID to the zone
  self.agents.push( agent );
  zone.extras.agent = agent.pid;

  // Catch information on the agent output
  agent.stdout.on( 'data', function( msg ) {
    try {
      self.logger.debug( msg.toString() );
    } catch( e ) {
      self.logger.error( 'Error decoding: %s', msg );
    }
  });

  // If the agent die; remove it from the list
  agent.on( 'exit', function() {
    self.logger.info( 'Removing agent: %s', agent.pid );
    self.agents.splice( _.indexOf( self.agents, agent ), 1 );
  });
};

// Stops a given zone agent
BudaManager.prototype._stopAgent = function( zone ) {
  // Kill agent
  if( this.config.docker ) {
    this.logger.debug( 'Stopping container agent: %s', zone.extras.agent );
    execSync( 'docker rm -f ' + zone.extras.agent );
  } else {
    this.logger.debug( 'Stopping subprocess agent: %s', zone.extras.agent );
    process.kill( zone.extras.agent, 'SIGINT' );
  }

  // Remove zone record
  this.zones.splice( _.indexOf( this.zones, zone ), 1 );
};

// Retrive a list of all zones in play
BudaManager.prototype._getZoneList = function() {
  return this.zones;
};

// Retrieve details of a specific zone
BudaManager.prototype._getZoneDetails = function( id ) {
  // Retrieve element from this.zones based on it's id
  var zone = _.filter( this.zones, function( el ) {
    return el.extras.id === id;
  });

  if( zone.length !== 1 ) {
    this.logger.warn( 'Invalid zone id: %s', id );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  zone = zone[ 0 ];

  return zone;
};

// Update and existing zone
BudaManager.prototype._updateZone = function( id, newData ) {
  // Retrieve element from this.zones based on it's id
  var zone = _.filter( this.zones, function( el ) {
    return el.extras.id === id;
  });

  if( zone.length !== 1 ) {
    this.logger.warn( 'Invalid zone id: %s', id );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  zone = zone[ 0 ];

  // Stop zone agent
  this._stopAgent( zone );

  // Create zone with newData
  return this._registerZone( newData );
};

// Delete a running zone
BudaManager.prototype._deleteZone = function( id ) {
  // Retrieve element from this.zones based on it's id
  var zone = _.filter( this.zones, function( el ) {
    return el.extras.id === id;
  });

  if( zone.length !== 1 ) {
    this.logger.warn( 'Invalid zone id: %s', id );
    return { error: true, desc: 'INVALID_ZONE_ID' };
  }
  zone = zone[ 0 ];

  // Stop zone agent
  this._stopAgent( zone );

  // Remove
  this.logger.info( 'Remove zone: %s', zone.extras.id );
  this.logger.debug({
    zone: zone
  }, 'Remove zone: %s', zone.extras.id );

  return zone;
};

// Register a new zone
BudaManager.prototype._registerZone = function( zone ) {
  // Validation function holder
  var zoneValidation;

  // Check zone details are present
  if( ! zone ) {
    this.logger.warn( 'Missing parameters' );
    return { error: true, desc: 'MISSING_PARAMETERS' };
  }

  // Not supported schema version?
  if( ! this.schemas[ 'zone-' + zone.version ] ) {
    this.logger.error( 'Unsupported schema version' );
    return { error: true, desc: 'UNSUPPORTED_SCHEMA_VERSION' };
  }

  // Validate zone against the schema version used
  zoneValidation = jsen( JSON.parse( this.schemas[ 'zone-' + zone.version ] ) );
  if( ! zoneValidation( zone ) ) {
    this.logger.error({ errors: zoneValidation.errors }, 'Invalid zone definition' );
    return {
      error:   true,
      desc:    'INVALID_ZONE_DEFINITION',
      details: zoneValidation.errors
    };
  }

  // Calculate ID
  zone.extras.id = getID( zone );

  // Start zone agent
  this._startAgent( zone );

  // Add zone to the list
  this.zones.push( zone );
  this.logger.info( 'Zone created: %s', zone.extras.id );
  this.logger.debug({
    zone: zone
  }, 'Zone created: %s', zone.extras.id );
  return zone;
};

// Show usage information
BudaManager.prototype.printHelp = function() {
  console.log( colors.green.bold( 'Buda Manager ver. ' + info.version ) );
  console.log( colors.white.bold( 'Available configuration options are:' ) );
  _.each( BudaManager.DEFAULTS, function( val, key ) {
    console.log( colors.gray( '\t' + key + '\t' + val ) );
  });
};

// Gracefully shutdown
BudaManager.prototype.exit = function() {
  // Give 500ms to each agent to gracefully exit
  // Then exit main process too
  setTimeout( _.bind( function() {
    this.logger.info( 'Exiting Manager' );
    process.exit();
  }, this ), this.agents.length * 500 );

  // Stop running agents
  this.logger.info( 'Stopping running agents' );
  _.each( this.zones, _.bind( function( zone ) {
    this._stopAgent( zone );
  }, this ) );
};

// Kickstart for the daemon process
BudaManager.prototype.start = function() {
  var schemaFiles;

  // Looking for help ?
  if( _.has( this.config, 'h' ) || _.has( this.config, 'help' ) ) {
    this.printHelp();
    process.exit();
  }

  // Log config
  this.logger.info( 'Buda Manager ver. ' + info.version );
  this.logger.debug({
    config: this.config
  }, 'Starting with configuration' );

  // Load schemas
  this.logger.info( 'Loading schemas' );
  schemaFiles = fs.readdirSync( path.join( __dirname, '../schemas' ) );
  _.each( schemaFiles, _.bind( function( el ) {
    var name = path.basename( el, '.json' );
    var file;

    if( name.charAt( 0 ) !== '.' ) {
      this.logger.debug( name );
      file = path.join( __dirname, '../schemas/', el );
      this.schemas[ name ] = fs.readFileSync( file ).toString();
    }
  }, this ) );

  // Home directory validations
  this.logger.info( 'Verifying working directory' );
  this._verifyHome();

  // Move process to working directory
  this.logger.info( 'Moving process to working directory' );
  process.chdir( this.config.home );

  // Start REST interface
  this.logger.info( 'Starting REST interface' );
  this._startInterface();
  this.logger.debug({
    config: this.restapi.info
  }, 'Interface started with configuration' );

  // Log final output
  this.logger.info( 'Initialization process complete' );

  // Listen for interruptions and gracefully shutdown
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( this.exit, this ) );
  process.on( 'SIGTERM', _.bind( this.exit, this ) );
};

module.exports = BudaManager;
