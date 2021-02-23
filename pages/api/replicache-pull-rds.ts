import {ensureDatabase, executeStatement} from './rds';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const uniqueID = Math.random().toString(36).substr(2);
  console.log(`Processing pull ${uniqueID}`, req.body);

  const result = await executeStatement('SELECT * FROM Shape LIMIT 40');

  res.json({
    clientView: Object.fromEntries(
      result.records.map(
        ([id, content]) => [id.stringValue, JSON.parse(content.stringValue)]))
  });
  res.end();
};