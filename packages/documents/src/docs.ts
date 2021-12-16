import { Client } from '@elastic/elasticsearch'

export const client = new Client({ node: process.env.ELK_HOST || 'http://localhost:9200' })