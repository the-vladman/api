// Enable strict syntax mode
'use strict';

// Base class
var BudaCSVAgent = require( '../../csv/lib/buda_agent_csv' );
var _ = require( 'underscore' );
var util = require( 'util' );
var info = require( '../package' );
var FeedSpec = require( './feed.spec' );

// Supported pollutants to store
var pollutants = [
  'O3',
  'PM10',
  'PM25',
  'CO',
  'SO2',
  'NO2'
];

// Valid index values
/* eslint no-unused-vars:0 */
var indices = [
  'AQHI_HK',
  'AQHI_CA',
  'AQI_US',
  'AQI_CN',
  'AQI_IN',
  'CAI',
  'CAQI',
  'DAQI',
  'IMECA',
  'PSI',
  'API'
];

// Constructor method
// Extends base CSV Agent definition
function AirQualityAgent( conf ) {
  this.log( info.name + ' ' + info.version );
  BudaCSVAgent.call( this, conf );
}
util.inherits( AirQualityAgent, BudaCSVAgent );

// FIX
// Temporary solution to get the value for source_id; the ideal approach
// will be the data is present in the records
function _findSourceID( station ) {
  var res = '';
  var list = {
    GDL: [ 'ATM', 'CEN', 'AGU', 'PIN', 'LDO', 'MIR', 'OBL', 'SFE', 'TLA', 'VAL' ],
    TLC: [ 'AP', 'CE', 'CB', 'MT', 'OX', 'SC', 'SM' ],
    MTY: [ 'SO', 'NO', 'CE', 'NE', 'SE', 'N', 'NO2', 'NE2', 'SE2', 'SO2' ]
  };

  /* eslint space-unary-ops:0 */
  _.each( list, function( k ) {
    if( _.indexOf( list[ k ], station ) > -1 ) {
      res = k;
    }
  });

  return res;
}

// Custom transform method to comply with the Air Quality Feed Spec
AirQualityAgent.prototype.transform = function( record ) {
  var m;
  var doc = new FeedSpec.FeedEntry();
  var date = new Date( record.fecha + ' ' + record.hora.split( '.' )[ 0 ] );

  /* eslint camelcase:0 */
  doc.stations[ 0 ].id = record.cve;
  doc.stations[ 0 ].name = record.nom;
  doc.stations[ 0 ].source_id = _findSourceID( record.cve );
  doc.stations[ 0 ].location.lat = record.lat;
  doc.stations[ 0 ].location.lon = record.lon;
  if( _.indexOf( pollutants, record.para ) >= 0 ) {
    m = new FeedSpec.Measurement();
    m.time = date;
    m.pollutant = record.para;
    m.unit = record.unidad || '';
    m.value = record.indice || '';
    m.averagedOverInHours = record.avetime || '';
    doc.stations[ 0 ].measurements.push( m );
  }

  return doc;
};

module.exports = AirQualityAgent;
