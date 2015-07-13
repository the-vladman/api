// Buda Front
// ==========
// Provides a RESTful API to access the data managed by a
// BUDA instance

// Enable strict syntax mode
'use strict';

// Load required modules
var _        = require( 'underscore' );
var colors   = require( 'colors' );
var fs       = require( 'fs' );
var path     = require( 'path' );
var bunyan   = require( 'bunyan' );
var mongoose = require( 'mongoose' );
var info     = require( './package' );

// Express and middleware
var express      = require( 'express' );
var compression  = require( 'compression' );
var bodyParser   = require( 'body-parser' );
var cookieParser = require( 'cookie-parser' );

// Constructor method
function BudaFront( config ) {
  // Runtime configuration holder
  this.config = _.defaults( config, BudaFront.DEFAULTS );
  
  // App logging interface
  this.logger = bunyan.createLogger({
    name: 'buda-front',
    stream: process.stdout,
    level: 'debug'
  });
  
  // HTTP server instance
  this.server = express();
  this.server.disable( 'x-powered-by' );
  this.server.use( compression() );
  this.server.use( cookieParser() );
  this.server.use( bodyParser.json() );
}

// Default config values
// - The MongoDB host/database to use for data access
// - Only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advaised ( or required )
BudaFront.DEFAULTS = {
  db: 'localhost:27017/buda',
  port: 8000
};

// Show usage information
BudaFront.prototype.printHelp = function() {
  console.log( colors.green.bold( 'Buda Front ver. ' + info.version ) );
  console.log( colors.white.bold( 'Available configuration options are:' ) );
  _.each( BudaFront.DEFAULTS, function( val, key ) {
    console.log( colors.gray( '\t' + key + '\t' + val ) );
  });
};

// Kickstart for the daemon process
BudaFront.prototype.start = function() {
  // Looking for help ?
  if( _.has( this.config, 'h' ) || _.has( this.config, 'help' ) ) {
    this.printHelp();
    process.exit();
  }
  
  // Local logger and server accesors
  var logger = this.logger;
  var server = this.server;
  
  // Log config
  logger.info( 'Buda Front ver. ' + info.version );
  logger.debug({
    config: this.config
  }, 'Starting with configuration' );
  
  // Connect to DB
  logger.info( 'Establishing database connection: %s', this.config.db );
  mongoose.connect( this.config.db );
  
  // Load application models
  logger.info( 'Loading application models' );
  fs.readdirSync( __dirname + '/app/models/' ).forEach( function( model ) {
    model = path.basename( model, '.js' );
    logger.debug( 'Loading model: %s', model );
    require( './app/models/' + model );
  });
  
  // Load application routers
  logger.info( 'Loading application routers' );
  fs.readdirSync( __dirname + '/app/routers/' ).forEach( function( router ) {
    router = path.basename( router, '.js' );
    logger.debug( 'Loading router: %s', router );
    server.use( '/' + router, require( './app/routers/' + router )({
      logger: logger
    }));
  });
  
  // Custom 404 error
  server.use( function( req, res, next ) {
    logger.debug( 'Invalid path' );
    res.status( 404 );
    res.json({
      error: 'INVALID_PATH'
    });
  });
  
  // Global error handler
  server.use( function( err, req, res, next ) {
    logger.fatal( err, 'Unexpected error' );
    res.status( err.status || 500 );
    res.json({
      error: err.message
    });
  });
  
  // Start listening for requests
  logger.info( 'Listening for requests on port: %s', this.config.port );
  server.listen( this.config.port );
};

// Exports constructor method
module.exports = BudaFront;