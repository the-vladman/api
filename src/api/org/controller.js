
import { success, notFound } from '../../services/response/'
import { makeObject } from '../../services/dataCollection/'
import mongoose from 'mongoose'
import aqp from 'api-query-params'


export const queries = (req, res, next) => {
  const max_page_size = 100
  const DataObject = makeObject(req.params.dataCollection)
  const query = aqp(req.query)
  if (query.filter.pagesize) {
    query.limit = query.filter.pagesize
    delete query.filter.pagesize
  }else{
    query.limit = max_page_size
  }
  console.log('Query', query)
  DataObject.count(query.filter)
    .then(total =>
      DataObject
      .find(query.filter)
      .skip(query.skip)
      .limit(query.limit || max_page_size)
      .sort(query.sort)
      .select(query.projection)
      .then((DataObjects) => ({
        total,
        results: DataObjects.map((DataObject) => DataObject)
      }))
    )
    .then(success(res))
    .catch(next)
}

export const index = ({ querymen: { query, select, cursor } }, res, next) =>
  res.status(200).json([])
