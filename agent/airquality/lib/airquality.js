// Enable strict syntax mode
'use strict';

// Base class
var BudaXMLAgent = require( '../../xml/lib/buda_agent_xml' );
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
// Extends base XML Agent definition
function AirQualityAgent( conf ) {
  this.log( info.name + ' ' + info.version );
  BudaXMLAgent.call( this, conf );
}
util.inherits( AirQualityAgent, BudaXMLAgent );

// Custom transform method to comply with the Air Quality Feed Spec
AirQualityAgent.prototype.transform = function( record ) {
  var m;
  var doc = new FeedSpec.FeedEntry();
  var date = record._attrs.ltime;

  // Format ugly dates
  date = date.slice( 0, 4 ) + '-' + date.slice( 4 );
  date = date.slice( 0, 7 ) + '-' + date.slice( 7 );
  date += ':00:00Z';

  doc.stations[ 0 ].id = record._attrs.id;
  doc.stations[ 0 ].name = record._attrs.name;
  _.each( record.samples, function( el ) {
    if( _.indexOf( pollutants, el._attrs.var ) >= 0 ) {
      m = new FeedSpec.Measurement();
      m.pollutant = el._attrs.var;
      m.time = date;
      m.unit = el._attrs.units || '';
      m.value = el.d._text || el.d || '';
      doc.stations[ 0 ].measurements.push( m );
    }
  });

  return doc;
};

module.exports = AirQualityAgent;
