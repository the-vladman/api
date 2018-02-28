
import { success, notFound } from '../../services/response/'
import { makeObject } from '../../services/dataCollection/'
import mongoose from 'mongoose'

import aqp from 'api-query-params'

export const index = ({ querymen: { query, select, cursor } }, res, next) =>
  res.status(200).json([])

export const show = ({ params }, res, next) =>
  res.status(200).json({})

export const queries = (req, res, next) => {
  console.log('req.query', req.query);
  const DataObject = makeObject(req.params.dataCollection)
  const query = aqp(req.query)
  console.log('Query', query);
  DataObject.find(query.filter)
    .skip(query.skip)
    .limit(query.limit)
    .sort(query.sort)
    .select(query.projection)
  // DataObject.count(filter)
  //   .then(count => DataObject.find(filter)
  //     .then((DataObjects) => ({
  //       count,
  //       results: DataObjects.map((DataObject) => DataObject)
  //     }))
  //   )
    .then(success(res))
    .catch(next)
}
