import { Router } from 'express'
import { middleware as query } from 'querymen'
import { index, queries } from './controller'

const router = new Router()

router.get('/',
  query(),
  index)

/**
 * @api {get} /org/:id Retrieve org
 * @apiName RetrieveOrg
 * @apiGroup Org
 * @apiSuccess {Object} org Org's data.
 * @apiError {Object} 400 Some parameters may contain invalid values.
 * @apiError 404 Org not found.
 */
router.get('/:dataCollection',
  queries)

export default router
