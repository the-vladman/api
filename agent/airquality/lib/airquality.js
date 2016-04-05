// Enable strict syntax mode
'use strict';

// Base class
var BudaCSVAgent = require( '../../csv/lib/buda_agent_csv' );
var _ = require( 'underscore' );
var util = require( 'util' );
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
function AirQualityAgent( conf, handlers ) {
  BudaCSVAgent.call( this, conf, handlers );
}
util.inherits( AirQualityAgent, BudaCSVAgent );

// Custom transform method to comply with the Air Quality Feed Spec
AirQualityAgent.prototype.transform = function( record ) {
  var m;
  var i;
  var doc = new FeedSpec.FeedEntry();
  var date = new Date( record.date + ' ' + record.time );

  if( record.source.trim() === '-' || record.source.trim() === '' ) {
    this.emit( 'error', record );
    return false;
  }

  /* eslint camelcase:0 */
  doc.stations[ 0 ].id = record.cve;
  doc.stations[ 0 ].name = record.station;
  doc.stations[ 0 ].source_id = record.source;
  doc.stations[ 0 ].location.lat = record.lat;
  doc.stations[ 0 ].location.lon = record.long;
  if( _.indexOf( pollutants, record.param ) >= 0 ) {
    m = new FeedSpec.Measurement();
    m.time = date;
    m.pollutant = record.param;
    m.unit = record.unit;
    m.value = record.concentration;
    m.averagedOverInHours = record.average;
    doc.stations[ 0 ].measurements.push( m );
  }

  i = new FeedSpec.Index();
  i.scale = 'IMECA';
  i.value = record.index;
  i.responsiblePollutant = '';
  i.calculationTime = date;
  doc.stations[ 0 ].indexes.push( i );

  return doc;
};

module.exports = AirQualityAgent;
