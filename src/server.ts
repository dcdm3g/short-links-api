import fastify from 'fastify'
import { PostgresError } from 'postgres'
import { z } from 'zod'
import { sql } from './lib/postgres'
import { redis } from './lib/redis'

const app = fastify()

app.post('/api/links', async (request, reply) => {
  const createLinkBodySchema = z.object({
    code: z.string().min(3),
    url: z.string().url(),
  })

  const { code, url } = createLinkBodySchema.parse(request.body)

  try {
    const [link] = await sql`
      INSERT INTO links (code, url)
      VALUES (${code}, ${url})
      RETURNING id
    `

    return reply.status(201).send({ linkId: link.id })
  } catch (error) {
    if (error instanceof PostgresError && error.code === '23505') {
      return reply.status(409).send({ message: 'Code already in use' })
    }

    return reply.status(500).send({ message: 'Internal server error' })
  }
})

app.get('/api/links', async () => {
  const links = await sql`
    SELECT *
    FROM links
    ORDER BY created_at DESC
  `

  return { links }
})

app.get('/:code', async (request, reply) => {
  const getLinkParamsSchema = z.object({
    code: z.string().min(3),
  })

  const { code } = getLinkParamsSchema.parse(request.params)

  const [link] = await sql`
    SELECT id, url
    FROM links
    WHERE code = ${code}
  `

  if (!link) {
    return reply.status(404).send({ message: 'Link not found' })
  }

  await redis.zIncrBy('clicks', 1, String(link.id))

  return reply.redirect(301, link.url)
})

app.get('/api/clicks', async () => {
  try {
    const clicks = await redis.zRangeByScoreWithScores('clicks', 0, 50)

    const formattedClicks = clicks
      .sort((a, b) => a.score - b.score)
      .map((click) => ({ linkId: Number(click.value), clicks: click.score }))

    return { metrics: formattedClicks }
  } catch (error) {
    console.log(error)
  }
})

app
  .listen({
    port: 3333,
  })
  .then(() => {
    console.log('HTTP server running!')
  })
