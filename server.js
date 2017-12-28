/* eslint no-sync:0, no-process-exit:0 */
// Buda Front
// ==========
// Provides a RESTful API to access the data managed by a
// BUDA instance

// Enable strict syntax mode
'use strict';

// Load required modules
var _ = require( 'underscore' );
var colors = require( 'colors' );
var fs = require( 'fs' );
var path = require( 'path' );
var bunyan = require( 'bunyan' );
var mongoose = require( 'mongoose' );
var info = require( './package' );

// Express and middleware
var express = require( 'express' );
var compression = require( 'compression' );
var bodyParser = require( 'body-parser' );
var cookieParser = require( 'cookie-parser' );

// Constructor method
function BudaFront( config ) {
  // Runtime configuration holder
  this.config = _.defaults( config, BudaFront.DEFAULTS );

  // App logging interface
  this.logger = bunyan.createLogger({
    name:   'buda-front',
    stream: process.stdout,
    level:  'debug'
  });

  // HTTP server instance
  this.server = express();
  this.server.disable( 'x-powered-by' );
  this.server.use( compression() );
  this.server.use( cookieParser() );
  this.server.use( bodyParser.json() );

  // Allow CORS and set version header
  this.server.use( function( req, res, next ) {
    var headers = 'Origin, X-Requested-With, Content-Type, Accept';

    res.header( 'Access-Control-Allow-Origin', '*' );
    res.header( 'Access-Control-Allow-Headers', headers );
    res.header( 'X-BUDA-Version', info.version );
    next();
  });
}

// Default config values
// - The MongoDB host/database to use for data access
// - Only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advaised ( or required )
BudaFront.DEFAULTS = {
  port:    8000,
  storage: 'localhost:27017/buda',
  title:   'BUDA',
  desc:    'Handled data catalog'
};

// Show usage information
BudaFront.prototype.printHelp = function() {
  console.log( colors.green.bold( 'Buda Front ver. ' + info.version ) );
  console.log( colors.white.bold( 'Available configuration options are:' ) );
  _.each( BudaFront.DEFAULTS, function( val, key ) {
    console.log( colors.gray( '\t' + key + '\t' + val ) );
  });
};

// Clean exit process
BudaFront.prototype.exit = function() {
  var self = this;

  // Close storage connection and exit
  self.logger.info( 'Stopping server' );
  mongoose.connection.close( function() {
    self.logger.debug( 'Storage disconnected' );
    self.logger.debug( 'Bye' );
    process.exit();
  });
};

// Kickstart for the daemon process
BudaFront.prototype.start = function() {
  var self = this;
  var logger = self.logger;
  var server = self.server;

  // Looking for help ?
  if( _.has( self.config, 'h' ) || _.has( self.config, 'help' ) ) {
    self.printHelp();
    process.exit();
  }

  // Log config
  logger.info( 'Buda Front ver. ' + info.version );
  logger.debug({
    config: self.config
  }, 'Starting with configuration' );

  // Connect to DB
  logger.info( 'Establishing database connection: %s', self.config.storage );
  mongoose.connect( 'mongodb://' + self.config.storage );

  // Load application models
  logger.info( 'Loading application models' );
  fs.readdirSync( path.join( __dirname, 'app/models/' ) ).forEach( function( model ) {
    logger.debug( 'Loading model: %s', model );
    require( './app/models/' + path.basename( model, '.js' ) );
  });

  // Load application routers
  logger.info( 'Loading application routers' );
  fs.readdirSync( path.join( __dirname, 'app/routers/' ) ).forEach( function( router ) {
    var route = path.basename( router, '.js' );

    logger.debug( 'Loading router: %s', route );
    server.use( '/' + route, require( './app/routers/' + route )({
      logger: logger,
      config: self.config
    }) );
  });

  // Custom 404 error
  server.use( function( req, res, next ) {
    logger.debug( 'Invalid path' );
    res.status( 404 );
    res.json({
      error: 'INVALID_PATH'
    });
    next();
  });

  // Global error handler
  server.use( function( err, req, res, next ) {
    logger.fatal( err, 'Unexpected error' );
    res.status( err.status || 500 );
    res.json({
      error: err.message
    });
    next();
  });

  // Start listening for requests
  logger.info( 'Listening for requests on port: %s', self.config.port );
  server.listen( self.config.port );

  // Listen for interruptions and gracefully shutdown
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( this.exit, this ) );
  process.on( 'SIGTERM', _.bind( this.exit, this ) );
};

// Exports constructor method
module.exports = BudaFront;
