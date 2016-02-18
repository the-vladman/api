// Enable strict syntax mode
'use strict';

// Measurement definition
var Measurement = function() {
  return {
    pollutant:           '',
    unit:                '',
    value:               '',
    time:                '',
    averagedOverInHours: ''
  };
};

// Index definition
var Index = function() {
  return {
    scale:                '',
    value:                '',
    responsiblePollutant: '',
    calculationTime:      ''
  };
};

// Station definition
/* eslint camelcase:0 */
var Station = function() {
  return {
    id:        '',
    name:      '',
    source_id: '',
    location:  {
      lat: '',
      lon: '',
      alt: ''
    },
    measurements: [],
    indexes:      []
  };
};

// Feed entry definition
var FeedEntry = function() {
  return { stations: [ new Station() ] };
};

module.exports.version = 'v0.91';
module.exports.Measurement = Measurement;
module.exports.Index = Index;
module.exports.Station = Station;
module.exports.FeedEntry = FeedEntry;
